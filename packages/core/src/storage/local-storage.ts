import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config.js";
import type { Storage } from "./storage.js";

// apps/api and apps/worker each run with their own cwd, so a relative
// STORAGE_DIR would resolve to two different places. Anchor it to the
// repo root instead, so both processes agree on where files live.
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const STORAGE_ROOT = path.isAbsolute(env.STORAGE_DIR)
  ? env.STORAGE_DIR
  : path.resolve(REPO_ROOT, env.STORAGE_DIR);

export class LocalStorage implements Storage {
  async save(documentId: string, filename: string, data: Buffer) {
    const dir = path.join(STORAGE_ROOT, documentId);
    await mkdir(dir, { recursive: true });
    // path.basename strips any directory components an attacker could
    // smuggle in the upload's filename (path traversal).
    const filePath = path.join(dir, path.basename(filename));
    await writeFile(filePath, data);
    return filePath;
  }

  async read(documentId: string) {
    const dir = path.join(STORAGE_ROOT, documentId);
    const [filename] = await readdir(dir);
    if (!filename) {
      throw new Error(`No stored file found for document ${documentId}`);
    }

    return { filename, data: await readFile(path.join(dir, filename)) };
  }

  async delete(documentId: string) {
    await rm(path.join(STORAGE_ROOT, documentId), { recursive: true, force: true });
  }
}

export const storage: Storage = new LocalStorage();
