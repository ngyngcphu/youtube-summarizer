import 'dotenv/config'
import { createYouTubeSummaryFlow } from './flow'
import { YouTubeSummarySharedStore } from './types'

async function main(): Promise<void> {
  console.log('🎬 YouTube Video Summarizer 🎬')
  console.log('This program will:')
  console.log('1. Extract content from a YouTube video')
  console.log('2. Identify key topics and explain them in simple language')
  console.log('3. Generate questions and answers for each topic')
  console.log('4. Create an HTML summary page')
  console.log('---------------------------------------------')

  const shared: YouTubeSummarySharedStore = {
    videoUrl: ''
  }

  try {
    const youtubeFlow = createYouTubeSummaryFlow()
    await youtubeFlow.run(shared)

    console.log('')
    console.log('✅ Summary generated successfully!')
    console.log(`📄 HTML Summary saved to: ${shared.outputPath}`)
    console.log('Open the HTML file in your browser to view the summary.')
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('❌ Error:', error.message)
    } else {
      console.error('❌ An unknown error occurred')
    }
    console.error('Please try again with a valid YouTube URL.')
  }
}

main().catch(console.error)
