import axios from 'axios';
import { YoutubeTranscript } from 'youtube-transcript';

/**
 * Fetches YouTube video metadata and transcript
 * @param videoUrl - The URL of the YouTube video
 * @returns Video title, description, transcript, and other metadata
 */
export async function fetchYouTubeVideo(videoUrl: string): Promise<{
  videoId: string;
  title: string;
  description: string;
  transcript: string;
  thumbnailUrl: string;
}> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error('Invalid YouTube URL - Could not extract video ID');
  }

  const metadata = await getVideoMetadata(videoId);

  let fullTranscript = '';
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    fullTranscript = transcript
      .map(item => item.text)
      .join(' ');

    if (!fullTranscript || fullTranscript.trim().length === 0) {
      throw new Error('Empty transcript');
    }
  } catch (error) {
    fullTranscript = 'Transcript unavailable. This could be due to disabled captions or region restrictions.';
  }

  return {
    videoId,
    title: metadata.title,
    description: metadata.description,
    transcript: fullTranscript,
    thumbnailUrl: metadata.thumbnailUrl,
  };
}

function extractVideoId(url: string): string | null {
  if (!url) {
    return null;
  }

  try {
    if (url.includes('youtu.be')) {
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 0 && pathSegments[0].length === 11) {
        return pathSegments[0];
      }
    }

    if (url.includes('youtube.com')) {
      const urlObj = new URL(url);
      const videoId = urlObj.searchParams.get('v');
      if (videoId && videoId.length === 11) {
        return videoId;
      }
    }

    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

async function getVideoMetadata(videoId: string) {
  try {
    const response = await axios.get(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);

    return {
      title: response.data.title || 'Unknown Title',
      description: response.data.description || 'No description available',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
  } catch (error) {
    return {
      title: 'Video Title (Could not fetch)',
      description: 'Video Description (Could not fetch)',
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
  }
}
