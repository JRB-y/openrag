import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import type { Root, RootContent } from "mdast";

export const processor = unified().use(remarkParse).use(remarkGfm).use(remarkStringify);

export function parseMarkdownToNodes(markdown: string): RootContent[] {
  const tree = processor.parse(markdown) as Root;
  return tree.children;
}

export function nodesToMarkdown(nodes: RootContent[]): string {
  const root: Root = { type: "root", children: nodes };
  return processor.stringify(root).trim();
}
