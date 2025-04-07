import { OpenAI } from 'openai';
import 'dotenv/config';

export async function callLlm(
  prompt: string,
  systemPrompt: string = ""
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey,
    defaultHeaders: {
      'HTTP-Referer': 'https://youtube-summarizer.com',
      'X-Title': 'YouTube Video Summarizer',
    },
  });

  const messages = [] as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;

  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }

  messages.push({ role: 'user', content: prompt });

  try {
    const r = await client.chat.completions.create({
      model: "deepseek/deepseek-chat-v3-0324:free",
      messages,
      temperature: 0.7,
    });

    if (!r || !r.choices || r.choices.length === 0) {
      return 'Error: Received empty response from LLM API. Please try again.';
    }

    const content = r.choices[0]?.message?.content;
    if (!content) {
      return 'Error: No content in LLM response. Please try again.';
    }

    return content;
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    return `Error calling LLM API: ${errorMessage}. Please check your API key and try again.`;
  }
}
