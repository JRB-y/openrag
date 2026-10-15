import TurndownService from "turndown";
// turndown-plugin-gfm ships no type declarations.
// @ts-expect-error -- untyped module, see above
import { gfm } from "turndown-plugin-gfm";

// Shared by docx.ts and html.ts: both go through an HTML intermediate
// representation before becoming Markdown. The GFM plugin is what
// keeps tables as Markdown tables instead of flattening them to text.
export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({ headingStyle: "atx" });
  turndown.use(gfm);

  // mammoth wraps every table cell's text in a <p>, which turndown's
  // default paragraph rule surrounds with blank lines - breaking the
  // single-line "| cell |" table syntax. Keep cell paragraphs inline.
  turndown.addRule("tableCellParagraph", {
    filter: (node) =>
      node.nodeName === "P" && ["TD", "TH"].includes(node.parentNode?.nodeName ?? ""),
    replacement: (content) => content,
  });

  return turndown.turndown(html);
}
