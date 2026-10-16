import type { RootContent } from "mdast";
import { nodesToMarkdown } from "./processor.js";
import { countTokens } from "./tokenizer.js";

function isAtomic(node: RootContent): boolean {
  return node.type === "table" || node.type === "code";
}

function tokensOf(node: RootContent): number {
  return countTokens(nodesToMarkdown([node]));
}

// Carries the trailing ~overlapTokens worth of nodes from one sub-chunk
// into the start of the next, so a split doesn't lose context mid-idea.
// overlapTokens <= 0 means no overlap at all. Otherwise, keeps at least
// the last node, even if it alone exceeds the overlap budget - unless
// that node is already as big as (or bigger than) a full target chunk,
// in which case it's not "a little trailing context" anymore and
// carrying it forward would just duplicate it wholesale into the next
// chunk instead.
function takeOverlap(nodes: RootContent[], overlapTokens: number, targetTokens: number): RootContent[] {
  if (overlapTokens <= 0) return [];

  const lastNode = nodes[nodes.length - 1];
  if (lastNode && tokensOf(lastNode) >= targetTokens) return [];

  const overlap: RootContent[] = [];
  let tokens = 0;

  for (let i = nodes.length - 1; i >= 0; i--) {
    const nodeTokens = tokensOf(nodes[i]!);
    if (tokens > 0 && tokens + nodeTokens > overlapTokens) break;
    overlap.unshift(nodes[i]!);
    tokens += nodeTokens;
  }

  return overlap;
}

// Splits a section's nodes into token-budgeted groups, one paragraph
// (or other block) at a time - never mid-node. A table or code block
// that alone exceeds the target becomes its own standalone group
// instead of being forced to split.
export function splitByTokenBudget(
  nodes: RootContent[],
  targetTokens: number,
  overlapTokens: number,
): RootContent[][] {
  const groups: RootContent[][] = [];
  let current: RootContent[] = [];
  let currentTokens = 0;

  const flush = () => {
    if (current.length > 0) groups.push(current);
  };

  for (const node of nodes) {
    const nodeTokens = tokensOf(node);

    if (isAtomic(node) && nodeTokens > targetTokens) {
      flush();
      groups.push([node]);
      current = [];
      currentTokens = 0;
      continue;
    }

    if (current.length > 0 && currentTokens + nodeTokens > targetTokens) {
      flush();
      current = takeOverlap(current, overlapTokens, targetTokens);
      currentTokens = countTokens(nodesToMarkdown(current));
    }

    current.push(node);
    currentTokens += nodeTokens;
  }

  flush();
  return groups;
}
