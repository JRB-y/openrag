import { env } from "../config.js";
import type { ParsePage } from "../parsers/types.js";
import { nodesToMarkdown, parseMarkdownToNodes } from "./processor.js";
import { findPageForOffset } from "./pages.js";
import { buildSections, mergeShortSections } from "./sections.js";
import { splitByTokenBudget } from "./split.js";
import { countTokens } from "./tokenizer.js";
import type { Chunk } from "./types.js";

export type { Chunk } from "./types.js";

// A section shorter than this merges into its neighbor rather than
// becoming its own near-empty chunk (DOCS.md §7: "éviter les chunks de
// 10 tokens").
const MIN_SECTION_TOKENS = 20;

export interface ChunkMarkdownOptions {
  pages?: ParsePage[];
  chunkSizeTokens?: number;
  chunkOverlapTokens?: number;
}

export function chunkMarkdown(markdown: string, options: ChunkMarkdownOptions = {}): Chunk[] {
  const {
    pages,
    chunkSizeTokens = env.CHUNK_SIZE_TOKENS,
    chunkOverlapTokens = env.CHUNK_OVERLAP_TOKENS,
  } = options;

  const nodes = parseMarkdownToNodes(markdown);
  const sections = mergeShortSections(buildSections(nodes), MIN_SECTION_TOKENS);

  const chunks: Chunk[] = [];

  for (const section of sections) {
    const groups = splitByTokenBudget(section.nodes, chunkSizeTokens, chunkOverlapTokens);

    for (const group of groups) {
      const content = nodesToMarkdown(group);
      const firstNode = group[0];

      chunks.push({
        index: chunks.length,
        content,
        headingPath: section.headingPath,
        page: findPageForOffset(pages, firstNode?.position?.start.offset),
        tokenCount: countTokens(content),
      });
    }
  }

  return chunks;
}
