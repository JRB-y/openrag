export interface Chunk {
  index: number;
  content: string;
  headingPath: string | null;
  page: number | null;
  tokenCount: number;
}
