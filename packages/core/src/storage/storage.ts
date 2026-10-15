export interface Storage {
  /** Saves a file under the given document and returns where it was stored. */
  save(documentId: string, filename: string, data: Buffer): Promise<string>;
  delete(documentId: string): Promise<void>;
}
