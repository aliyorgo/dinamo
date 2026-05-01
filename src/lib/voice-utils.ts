export function cleanVoiceName(name: string): string {
  return name.split(/\s*[-–—−•·|()/]\s*/)[0].trim()
}
