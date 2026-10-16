import type { StructuredTextItem } from "unpdf";

const MAX_HEADING_DEPTH = 3; // keep in sync with chunking/sections.ts
const HEADING_SIZE_RATIO = 1.2; // a line must be noticeably bigger than body text
const MAX_HEADING_SHARE = 0.3; // if more lines than this look like "headings", the signal is noise

interface TextLine {
  text: string;
  fontSize: number;
}

function linesFromItems(items: StructuredTextItem[]): TextLine[] {
  const lines: TextLine[] = [];
  let current: StructuredTextItem[] = [];

  const flush = () => {
    const text = current
      .map((item) => item.str)
      .join("")
      .trim();
    const sizes = current.filter((item) => item.str.trim() !== "").map((item) => item.fontSize);

    if (text !== "" && sizes.length > 0) {
      lines.push({ text, fontSize: Math.max(...sizes) });
    }
    current = [];
  };

  for (const item of items) {
    current.push(item);
    if (item.hasEOL) flush();
  }
  flush();

  return lines;
}

function roundSize(size: number): number {
  return Math.round(size * 2) / 2; // group near-identical sizes (float noise from the PDF matrix)
}

// PDFs carry no Markdown heading syntax - a title is just text in a
// bigger font. We reconstruct lines (with their font size) from pdf.js's
// raw text items, find the most common size ("body text"), and treat
// any noticeably larger size as a heading level - largest first. This
// is noise-guarded: if "most" lines look oversized (e.g. a poster-style
// PDF with uniformly large text), detection backs off entirely rather
// than mislabeling the whole document as headings.
export function detectHeadingLines(pageItems: StructuredTextItem[][]): Map<string, number> {
  const allLines = pageItems.flatMap(linesFromItems);
  if (allLines.length === 0) return new Map();

  const sizeCounts = new Map<number, number>();
  for (const line of allLines) {
    const size = roundSize(line.fontSize);
    sizeCounts.set(size, (sizeCounts.get(size) ?? 0) + 1);
  }

  const bodySize = [...sizeCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const threshold = bodySize * HEADING_SIZE_RATIO;

  const headingLines = allLines.filter((line) => roundSize(line.fontSize) > threshold);
  if (headingLines.length === 0 || headingLines.length / allLines.length > MAX_HEADING_SHARE) {
    return new Map();
  }

  const tiers = [...new Set(headingLines.map((line) => roundSize(line.fontSize)))].sort((a, b) => b - a);

  const depthBySize = new Map(tiers.map((size, i) => [size, Math.min(i + 1, MAX_HEADING_DEPTH)]));

  const depthByText = new Map<string, number>();
  for (const line of headingLines) {
    depthByText.set(line.text, depthBySize.get(roundSize(line.fontSize))!);
  }

  return depthByText;
}

// Prefixes lines of `pageText` that match a detected heading with the
// right number of `#`. Matched by normalized (whitespace-collapsed)
// text, since the flowing per-page text and the raw item-reconstructed
// lines aren't guaranteed to be byte-identical.
export function applyHeadingMarkup(pageText: string, headingDepthByText: Map<string, number>): string {
  if (headingDepthByText.size === 0) return pageText;

  const normalizedDepths = new Map(
    [...headingDepthByText].map(([text, depth]) => [text.replace(/\s+/g, " ").trim(), depth]),
  );

  return pageText
    .split("\n")
    .map((line) => {
      const depth = normalizedDepths.get(line.replace(/\s+/g, " ").trim());
      return depth ? `${"#".repeat(depth)} ${line.trim()}` : line;
    })
    .join("\n");
}
