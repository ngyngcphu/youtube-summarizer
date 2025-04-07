import fs from 'fs';
import path from 'path';

/**
 * Saves content to a file
 * @param fileName - Name of the file to save
 * @param content - Content to write to the file
 * @param directory - Directory to save the file in (default: output)
 * @returns The full path to the saved file
 */
export async function saveToFile(
  fileName: string,
  content: string,
  directory: string = 'output'
): Promise<string> {
  const dirPath = path.resolve(process.cwd(), directory);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const filePath = path.join(dirPath, fileName);
  fs.writeFileSync(filePath, content, 'utf8');

  return filePath;
}
