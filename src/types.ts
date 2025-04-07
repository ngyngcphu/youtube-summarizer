export interface YouTubeSummarySharedStore {
  videoUrl: string;
  videoId?: string;
  title?: string;
  description?: string;
  transcript?: string;
  thumbnailUrl?: string;
  topics?: Array<{
    title: string;
    explanation: string;
    questions?: Array<{
      question: string;
      answer: string;
    }>;
  }>;
  outputHtml?: string;
  outputPath?: string;
}
