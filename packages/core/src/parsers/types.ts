export interface ParsePage {
  page: number;
  startOffset: number;
}

export interface ParseResult {
  title: string;
  markdown: string;
  pages?: ParsePage[];
}
