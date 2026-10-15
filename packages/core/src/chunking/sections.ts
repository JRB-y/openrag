import { toString as nodeToString } from "mdast-util-to-string";
import type { RootContent } from "mdast";
import { countTokens } from "./tokenizer.js";
import { nodesToMarkdown } from "./processor.js";

export interface Section {
  headingPath: string | null;
  nodes: RootContent[];
}

const MAX_HEADING_DEPTH = 3; // H1 > H2 > H3, per DOCS.md §7

// Groups top-level Markdown nodes into sections, one per H1/H2/H3
// heading, each carrying the full breadcrumb of its ancestor headings
// (e.g. "Guide RH > Congés > Congés payés"). Headings deeper than H3,
// and any content appearing before the first heading, stay in whichever
// section is currently open instead of starting a new one.
export function buildSections(nodes: RootContent[]): Section[] {
  const sections: Section[] = [];
  const headingStack: (string | undefined)[] = [];
  let current: Section = { headingPath: null, nodes: [] };

  const flush = () => {
    if (current.nodes.length > 0) {
      sections.push(current);
    }
  };

  for (const node of nodes) {
    if (node.type === "heading" && node.depth <= MAX_HEADING_DEPTH) {
      flush();
      headingStack.length = node.depth - 1;
      headingStack[node.depth - 1] = nodeToString(node);
      current = {
        headingPath: headingStack.filter(Boolean).join(" > ") || null,
        nodes: [],
      };
      continue;
    }

    current.nodes.push(node);
  }

  flush();
  return sections;
}

// A section with only a couple of words (e.g. a heading immediately
// followed by another heading) merges into the next one, so its
// content isn't thrown away as its own near-empty chunk. The last
// section has no "next" to join, so it merges into the previous one
// instead.
export function mergeShortSections(sections: Section[], minTokens: number): Section[] {
  const result: Section[] = [];
  let carryover: RootContent[] = [];

  sections.forEach((section, i) => {
    const nodes = [...carryover, ...section.nodes];
    carryover = [];

    const isLast = i === sections.length - 1;
    if (!isLast && countTokens(nodesToMarkdown(nodes)) < minTokens) {
      carryover = nodes;
      return;
    }

    result.push({ headingPath: section.headingPath, nodes });
  });

  if (carryover.length > 0) {
    if (result.length > 0) {
      result[result.length - 1]!.nodes.push(...carryover);
    } else {
      result.push({ headingPath: null, nodes: carryover });
    }
  }

  return result;
}
