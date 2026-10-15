import path from "node:path";

export function firstHeadingTitle(markdown: string): string | undefined {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim();
}

export function filenameToTitle(filename: string): string {
  return path.basename(filename, path.extname(filename));
}
