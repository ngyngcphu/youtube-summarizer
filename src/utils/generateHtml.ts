/**
 * Generates an HTML page from the summary data
 * @param summaryData - The structured summary data
 * @returns HTML string for the summary page
 */
export function generateHtml(summaryData: {
  videoId: string;
  videoUrl: string;
  title: string;
  thumbnailUrl: string;
  topics: Array<{
    title: string;
    explanation: string;
    questions?: Array<{
      question: string;
      answer: string;
    }>;
  }>;
}): string {
  const validTopics = Array.isArray(summaryData.topics) ? summaryData.topics : [];

  const generateQuestionsHtml = (topic: any) => {
    if (!topic.questions || !Array.isArray(topic.questions) || topic.questions.length === 0) {
      return `
        <div class="question">
          <strong>Q: What is ${topic.title} about?</strong>
        </div>
        <div class="answer">
          <strong>A:</strong> ${topic.explanation || 'This is an important concept from the video.'}
        </div>
      `;
    }

    return topic.questions.map((qa: any) => {
      const question = qa?.question || 'What is this about?';
      const answer = qa?.answer || 'This is an important concept.';
      return `
        <div class="question">
          <strong>Q: ${question}</strong>
        </div>
        <div class="answer">
          <strong>A:</strong> ${answer}
        </div>
      `;
    }).join('');
  };

  const generateTopicsHtml = () => {
    if (validTopics.length === 0) {
      return `
        <div class="topic">
          <h3>Video Summary</h3>
          <p>We couldn't extract specific topics from this video. Please try again or try with a different video.</p>
        </div>
      `;
    }

    return validTopics.map(topic => {
      const title = topic?.title || 'Untitled Topic';
      const explanation = topic?.explanation || 'No explanation available.';

      return `
        <div class="topic">
          <h3>${title}</h3>
          <p>${explanation}</p>
          
          <h4>Let's Learn More:</h4>
          ${generateQuestionsHtml(topic)}
        </div>
      `;
    }).join('');
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${summaryData.title || 'YouTube Video Summary'} - Kid-Friendly Summary</title>
      <style>
        body {
          font-family: 'Comic Sans MS', cursive, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f0f8ff;
          color: #333;
          line-height: 1.6;
        }
        h1, h2, h3 {
          color: #0078d7;
        }
        .video-container {
          text-align: center;
          margin-bottom: 20px;
        }
        .topic {
          background-color: #fff;
          border-radius: 10px;
          padding: 15px;
          margin-bottom: 20px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .question {
          background-color: #e6f7ff;
          border-left: 4px solid #0078d7;
          padding: 10px;
          margin: 10px 0;
        }
        .answer {
          background-color: #f0fff0;
          border-left: 4px solid #00a651;
          padding: 10px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <h1>Video Summary: ${summaryData.title || 'YouTube Video'}</h1>
      
      <div class="video-container">
        <img src="${summaryData.thumbnailUrl || `https://img.youtube.com/vi/${summaryData.videoId}/maxresdefault.jpg`}" alt="${summaryData.title || 'Video thumbnail'}" style="max-width: 100%;">
        <p><a href="${summaryData.videoUrl || `https://www.youtube.com/watch?v=${summaryData.videoId}`}" target="_blank">Watch the original video</a></p>
      </div>
      
      <h2>What This Video Is About:</h2>
      
      ${generateTopicsHtml()}
    </body>
    </html>
  `;
}
