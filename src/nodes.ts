import { Node, BatchNode } from 'pocketflow'
import { callLlm } from './utils/callLlm'
import { fetchYouTubeVideo } from './utils/fetchYouTubeVideo'
import { generateHtml } from './utils/generateHtml'
import { saveToFile } from './utils/fileUtils'
import { YouTubeSummarySharedStore } from './types'
import PromptSync from 'prompt-sync'

const prompt = PromptSync()

// Node 1: Extract YouTube Video Content
export class VideoExtractionNode extends Node<YouTubeSummarySharedStore> {
  async prep(shared: YouTubeSummarySharedStore): Promise<string> {
    // Get the URL from shared memory
    if (!shared.videoUrl) {
      throw new Error('No YouTube URL provided')
    }
    return shared.videoUrl
  }

  async exec(videoUrl: string): Promise<any> {
    console.log('Fetching YouTube video data...')
    return await fetchYouTubeVideo(videoUrl)
  }

  async post(
    shared: YouTubeSummarySharedStore,
    _: unknown,
    execRes: any,
  ): Promise<string | undefined> {
    // Store video data in shared memory
    shared.videoId = execRes.videoId
    shared.title = execRes.title
    shared.description = execRes.description
    shared.transcript = execRes.transcript
    shared.thumbnailUrl = execRes.thumbnailUrl

    console.log(`Video extracted: ${shared.title}`)
    return 'default' // Go to the next node
  }
}

// Node 2: Analyze Content and Identify Topics
export class ContentAnalysisNode extends Node<YouTubeSummarySharedStore> {
  async prep(shared: YouTubeSummarySharedStore): Promise<string> {
    // Prepare data for content analysis
    return JSON.stringify({
      videoId: shared.videoId,
      title: shared.title,
      description: shared.description,
      transcript: shared.transcript
    })
  }

  async exec(data: string): Promise<string> {
    const parsedData = JSON.parse(data)

    const systemPrompt = "You are an expert at analyzing video content and identifying key topics. " +
      "Extract 5-8 main topics from this video transcript, and provide a detailed yet simple explanation for each topic. " +
      "While keeping language simple enough for a young audience, include specific examples, key points, and interesting details from the video. " +
      "Each explanation should be 3-5 sentences long to provide comprehensive coverage."

    const prompt = `I need to create a comprehensive summary of this YouTube video:

` +
      `Title: ${parsedData.title}
` +
      `Description: ${parsedData.description}

` +
      `Transcript: ${parsedData.transcript}

` +
      `Please identify 5-8 key topics from this video and provide a detailed explanation for each topic. ` +
      `For each topic, include specific examples, key points, and interesting details mentioned in the video. ` +
      `Each explanation should be 3-5 sentences long to provide comprehensive coverage. ` +
      `Format your response as a JSON array with this structure: ` +
      `[{"title": "Topic Title", "explanation": "Detailed explanation with examples and key points..."}]`

    console.log('Analyzing video content to identify key topics with detailed explanations...')
    const result = await callLlm(prompt, systemPrompt)
    return result
  }

  async post(
    shared: YouTubeSummarySharedStore,
    _: unknown,
    execRes: string,
  ): Promise<string | undefined> {
    try {
      // Check if the response contains an error message from the LLM API
      if (execRes.startsWith('Error:') || execRes.startsWith('Error calling LLM API:')) {
        console.error('Received error from LLM API:', execRes);
        // Create default topics as fallback
        shared.topics = [
          { title: 'Main Topic', explanation: 'The main subject discussed in the video.' },
          { title: 'Key Points', explanation: 'Important points mentioned in the video.' },
          { title: 'Summary', explanation: 'A brief overview of the video content.' }
        ];
        console.log('Using default topics due to LLM API error');
        return 'default';
      }

      // Clean up the response - remove markdown code blocks if present
      let cleanedResponse = execRes;

      console.log('Processing LLM response for JSON extraction');

      // Check for markdown code blocks
      if (execRes.includes('```')) {
        // Extract content between markdown code blocks
        const codeBlockMatch = execRes.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (codeBlockMatch && codeBlockMatch[1]) {
          console.log('Found JSON in markdown code block, extracting...');
          cleanedResponse = codeBlockMatch[1].trim();
        }
      }

      // Parse the JSON response from the LLM
      shared.topics = JSON.parse(cleanedResponse);
      console.log(`Identified ${shared.topics?.length || 0} topics from the video`);
      return 'default'; // Go to the next node
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      // Try to extract topics using regex as a fallback
      const topics = this.extractTopicsWithRegex(execRes);
      if (topics.length > 0) {
        shared.topics = topics;
        console.log(`Extracted ${topics.length} topics using fallback method`);
        return 'default';
      }

      // Last resort fallback if everything else fails
      shared.topics = [
        { title: 'Main Topic', explanation: 'The main subject discussed in the video.' },
        { title: 'Key Points', explanation: 'Important points mentioned in the video.' },
        { title: 'Summary', explanation: 'A brief overview of the video content.' }
      ];
      console.log('Using default topics as last resort');
      return 'default';
    }
  }

  // Fallback method to extract topics if JSON parsing fails
  private extractTopicsWithRegex(text: string): Array<{ title: string; explanation: string }> {
    const topics: Array<{ title: string; explanation: string }> = []

    // First attempt: Look for patterns like 'Topic: X' or '1. X' followed by explanations
    try {
      // Handle numbered lists or topics with explicit labels
      const topicRegex = /(?:Topic[\s]*:?[\s]*(.*?)\n|[\d]+\.\s*(.*?)\n)([\s\S]*?)(?=(?:Topic[\s]*:|[\d]+\.)|$)/gi

      let match;
      while ((match = topicRegex.exec(text)) !== null) {
        // Safe access to match groups with null coalescing
        const title = ((match[1] || match[2]) || '').trim()
        const explanation = (match[3] || '').trim()
        if (title && explanation) {
          topics.push({ title, explanation })
        }
      }
    } catch (e) {
      console.error('Error in first regex extraction attempt:', e)
    }

    // If no topics found, try a simpler approach - look for paragraphs
    if (topics.length === 0) {
      try {
        // Split by double newlines to get paragraphs
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0)

        // If we have some paragraphs, try to extract topics
        for (let i = 0; i < paragraphs.length; i++) {
          const paragraph = paragraphs[i].trim()

          // Check if paragraph starts with a number or has a colon
          const titleMatch = paragraph.match(/^(?:[\d]+\.\s*|.*?\:)\s*(.*)/i)

          if (titleMatch && titleMatch[1]) {
            // We found something that looks like a title
            const title = titleMatch[1].trim()
            // Use the next paragraph as explanation if available, otherwise use remainder of current paragraph
            const explanation = (i + 1 < paragraphs.length) ? paragraphs[i + 1].trim() : ''

            if (title && explanation) {
              topics.push({ title, explanation })
              i++ // Skip the next paragraph as we used it for explanation
            }
          }
        }
      } catch (e) {
        console.error('Error in second regex extraction attempt:', e)
      }
    }

    // Last resort: If still no topics found, create a generic one
    if (topics.length === 0 && text.trim().length > 0) {
      const title = 'Main Topic'
      const explanation = text.trim().substring(0, Math.min(text.length, 500))
      topics.push({ title, explanation })
    }

    return topics
  }
}

// Node 3: Map-Reduce Topic Processing Node
export class TopicProcessingNode extends BatchNode<YouTubeSummarySharedStore, any> {
  /**
   * MAP PHASE: Step 1 - Split topics into individual processing units
   * This method extracts the list of topics that will be processed independently
   */
  async batchItems(shared: YouTubeSummarySharedStore): Promise<any[]> {
    if (!shared.topics || shared.topics.length === 0) {
      console.log('No topics found, creating a placeholder topic')
      return [{
        title: 'Video Summary',
        explanation: 'This video covers various topics.'
      }]
    }

    console.log(`MAP PHASE: Splitting ${shared.topics.length} topics for parallel processing...`)
    return shared.topics
  }

  /**
   * MAP PHASE: Step 2 - Process each topic independently (the 'map' operation)
   * This function processes a single topic in isolation, generating Q&As for it
   */
  async processBatchItem(topic: any): Promise<{ topic: any; questions: Array<{ question: string; answer: string }> }> {
    // Validate topic data
    const title = topic?.title || 'Untitled Topic'
    const explanation = topic?.explanation || 'No detailed explanation available.'

    console.log(`MAP OPERATION: Processing topic '${title}'`)

    try {
      const systemPrompt = "You are a skilled educator who explains complex topics in clear, engaging ways. " +
        "Create 4-6 comprehensive question and answer pairs about this topic. " +
        "Include a mix of basic understanding questions and more thought-provoking questions. " +
        "Answers should be detailed (2-4 sentences) and include specific examples or evidence from the topic explanation."

      const prompt = `Topic: ${title}

` +
        `Explanation: ${explanation}

` +
        `Generate 4-6 comprehensive question and answer pairs about this topic. ` +
        `Include a mix of basic understanding questions and more exploratory questions. ` +
        `Each answer should be 2-4 sentences long and include specific examples or evidence from the topic explanation. ` +
        `Format your response as a JSON array with this structure: ` +
        `[{"question": "Question that tests understanding?", "answer": "Detailed answer with examples..."}]`

      console.log(`Generating Q&A for topic: ${title}`)
      const result = await callLlm(prompt, systemPrompt)

      // Check if the response contains an error message from the LLM API
      if (result.startsWith('Error:') || result.startsWith('Error calling LLM API:')) {
        console.error(`Received error from LLM API for topic ${title}:`, result);
        return {
          topic,
          questions: [
            { question: `What is ${title} about?`, answer: explanation.substring(0, 100) + '...' },
            { question: 'Why is this important?', answer: 'It helps us understand a key concept from the video.' }
          ]
        };
      }

      try {
        // Clean up the response - remove markdown code blocks if present
        let cleanedResponse = result;

        console.log(`Processing LLM response for topic: ${title}`);

        // Check for markdown code blocks
        if (result.includes('```')) {
          // Extract content between markdown code blocks
          const codeBlockMatch = result.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch && codeBlockMatch[1]) {
            console.log('Found JSON in markdown code block, extracting...');
            cleanedResponse = codeBlockMatch[1].trim();
          }
        }

        // Parse the JSON response
        const questions = JSON.parse(cleanedResponse);
        console.log(`Successfully parsed ${questions.length} Q&A pairs for topic: ${title}`);

        // Validate questions array - ensure it's not empty and has valid entries
        if (!Array.isArray(questions) || questions.length === 0) {
          throw new Error('Parsed result is not a valid array or is empty');
        }

        // Make sure each question has both question and answer fields
        const validQuestions = questions.filter(q => q && typeof q === 'object' && q.question && q.answer);
        if (validQuestions.length === 0) {
          throw new Error('No valid question-answer pairs found');
        }

        return { topic, questions: validQuestions };
      } catch (error) {
        console.log(`JSON parsing failed for topic: ${title}, trying regex extraction`);
        // Fallback: extract Q&A with regex
        const questions = this.extractQAWithRegex(result);
        if (questions && questions.length > 0) {
          console.log(`Extracted ${questions.length} Q&A pairs using fallback method`);
          return { topic, questions };
        }

        // If regex extraction fails, use default questions
        console.log(`Fallback extraction failed, using default questions for topic: ${title}`);
        return {
          topic,
          questions: [
            { question: `What is ${title} about?`, answer: explanation.substring(0, 100) + (explanation.length > 100 ? '...' : '') },
            { question: 'Why is this important?', answer: 'It helps us understand a key concept from the video.' }
          ]
        };
      }
    } catch (error) {
      console.error(`Error processing Q&A for topic: ${title}`, error)
      // Return default questions if everything fails
      return {
        topic,
        questions: [
          { question: `What is ${title} about?`, answer: 'It is an interesting topic from the video.' },
          { question: 'Why is this important?', answer: 'It helps us understand something new.' }
        ]
      }
    }
  }

  /**
   * REDUCE PHASE: Combine all individual topic results into the final structure
   * This is the 'reduce' operation that aggregates results from all topics
   */
  async finalizeBatch(
    shared: YouTubeSummarySharedStore,
    _: unknown,
    batchResults: Array<{ topic: any; questions: Array<{ question: string; answer: string }> }>,
  ): Promise<string | undefined> {
    console.log('REDUCE PHASE: Beginning to combine results from all topic processors');

    // REDUCE OPERATION: Combine all processed topics back into a unified structure
    if (shared.topics && Array.isArray(shared.topics)) {
      console.log(`Reducing ${batchResults.length} processed topics into final structure`);

      // Create a map of topic titles to batch results for faster lookups
      const resultMap = new Map();
      batchResults.forEach(result => {
        if (result && result.topic && result.topic.title) {
          resultMap.set(result.topic.title, result);
        }
      });

      // Aggregate: Combine results from individual topics into the final structure
      let successfulMatches = 0;
      let fallbacksCreated = 0;

      for (let i = 0; i < shared.topics.length; i++) {
        const topic = shared.topics[i];
        // Find matching batch result using our map for efficient lookup
        const matchingResult = resultMap.get(topic.title);

        if (matchingResult && matchingResult.questions) {
          successfulMatches++;
          console.log(`REDUCE: Attaching ${matchingResult.questions.length} Q&A pairs to topic '${topic.title}'`);
          shared.topics[i].questions = matchingResult.questions;
        } else {
          // Create default questions if no matching batch result
          fallbacksCreated++;
          console.log(`REDUCE: No matching result for topic '${topic.title}', creating default questions`);
          shared.topics[i].questions = [
            { question: `What is ${topic.title} about?`, answer: topic.explanation.substring(0, 100) + (topic.explanation.length > 100 ? '...' : '') },
            { question: 'Why is this important?', answer: 'It helps us understand a key concept from the video.' }
          ];
        }
      }

      // Verify consistency of the final reduced structure
      let topicsWithQuestions = 0;
      for (const topic of shared.topics) {
        if (topic.questions && Array.isArray(topic.questions)) {
          topicsWithQuestions++;
        } else {
          console.log(`REDUCE: Fixing missing questions array for topic '${topic.title}'`);
          topic.questions = [
            { question: `What is ${topic.title} about?`, answer: 'This is an important concept from the video.' },
            { question: 'Tell me more about this?', answer: topic.explanation }
          ];
          fallbacksCreated++;
        }
      }

      console.log('REDUCE PHASE COMPLETE:');
      console.log(`- Topics processed: ${shared.topics.length}`);
      console.log(`- Successful matches: ${successfulMatches}`);
      console.log(`- Fallbacks created: ${fallbacksCreated}`);
      console.log(`- Topics with questions: ${topicsWithQuestions}`);

    } else {
      console.error('REDUCE ERROR: No topics found in shared store or topics is not an array');
    }

    console.log('Map-Reduce processing complete');
    return 'default'; // Go to the next node
  }

  // Fallback method to extract Q&A if JSON parsing fails
  private extractQAWithRegex(text: string): Array<{ question: string; answer: string }> {
    const qaItems: Array<{ question: string; answer: string }> = []

    try {
      // Look for patterns like 'Q: X' followed by 'A: Y'
      const qaRegex = /Q:?\s*(.*?)\s*(?:\n|\r\n)\s*A:?\s*(.*?)(?=(?:\n|\r\n)\s*Q:|$)/gis

      let match;
      while ((match = qaRegex.exec(text)) !== null) {
        if (match && match.length >= 3) {
          const question = match[1]?.trim() || ''
          const answer = match[2]?.trim() || ''
          if (question && answer) {
            qaItems.push({ question, answer })
          }
        }
      }
    } catch (e) {
      console.error('Error in QA regex extraction:', e)
    }

    // If no QA pairs found, try to split by double newlines and look for question marks
    if (qaItems.length === 0) {
      try {
        const lines = text.split(/\n+/)

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim()
          // If line ends with question mark, treat as question
          if (line.endsWith('?')) {
            const question = line
            // Use next line as answer if available
            const answer = (i + 1 < lines.length) ? lines[i + 1].trim() : ''

            if (question && answer) {
              qaItems.push({ question, answer })
              i++ // Skip the answer line in next iteration
            }
          }
        }
      } catch (e) {
        console.error('Error in secondary QA extraction:', e)
      }
    }

    // As a last resort, if we still have no Q&As, create a default pair
    if (qaItems.length === 0 && text.trim().length > 0) {
      qaItems.push({
        question: 'What is this topic about?',
        answer: text.trim().substring(0, Math.min(text.length, 100)) + '...'
      })
    }

    return qaItems
  }
}

// Node 4: Generate HTML Summary Page
export class HTMLGenerationNode extends Node<YouTubeSummarySharedStore> {
  async prep(shared: YouTubeSummarySharedStore): Promise<any> {
    // Prepare data for HTML generation
    return {
      videoId: shared.videoId,
      videoUrl: shared.videoUrl,
      title: shared.title,
      thumbnailUrl: shared.thumbnailUrl,
      topics: shared.topics
    }
  }

  async exec(data: any): Promise<{ html: string; fileName: string }> {
    console.log('Generating HTML summary page...')
    // Generate HTML from summary data
    const html = generateHtml(data)
    const fileName = `${data.videoId}_summary.html`

    return { html, fileName }
  }

  async post(
    shared: YouTubeSummarySharedStore,
    _: unknown,
    execRes: { html: string; fileName: string },
  ): Promise<string | undefined> {
    // Save HTML to file
    const { html, fileName } = execRes
    shared.outputHtml = html

    // Save the HTML file
    const outputPath = await saveToFile(fileName, html)
    shared.outputPath = outputPath

    console.log(`Summary HTML saved to: ${outputPath}`)
    return undefined // End of flow
  }
}

// Input Node to get YouTube URL from user
export class GetYouTubeURLNode extends Node<YouTubeSummarySharedStore> {
  async exec(): Promise<string> {
    // Get YouTube URL from user input
    const videoUrl = prompt('Enter YouTube URL: ') || ''
    if (!videoUrl || !videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
      throw new Error('Please enter a valid YouTube URL')
    }
    return videoUrl
  }

  async post(
    shared: YouTubeSummarySharedStore,
    _: unknown,
    execRes: string,
  ): Promise<string | undefined> {
    // Store the YouTube URL
    shared.videoUrl = execRes
    return 'default' // Go to the next node
  }
}
