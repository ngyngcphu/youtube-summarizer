import { Flow } from 'pocketflow'
import {
  GetYouTubeURLNode,
  VideoExtractionNode,
  ContentAnalysisNode,
  TopicProcessingNode,
  HTMLGenerationNode
} from './nodes'
import { YouTubeSummarySharedStore } from './types'

export function createYouTubeSummaryFlow(): Flow {
  // Create nodes
  const getYouTubeURLNode = new GetYouTubeURLNode()
  const videoExtractionNode = new VideoExtractionNode()
  const contentAnalysisNode = new ContentAnalysisNode()
  const topicProcessingNode = new TopicProcessingNode()
  const htmlGenerationNode = new HTMLGenerationNode()

  // Connect nodes in sequence
  getYouTubeURLNode.next(videoExtractionNode)
  videoExtractionNode.next(contentAnalysisNode)
  contentAnalysisNode.next(topicProcessingNode)
  topicProcessingNode.next(htmlGenerationNode)

  // Create flow starting with input node
  return new Flow<YouTubeSummarySharedStore>(getYouTubeURLNode)
}
