import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTxt } from "./txt.js";

const fixturesDir = path.join(import.meta.dirname, "fixtures");

describe("parseTxt", () => {
  it("reads the content as-is and titles it from the filename", async () => {
    const buffer = await readFile(path.join(fixturesDir, "sample.txt"));
    const result = parseTxt(buffer, "sample.txt");

    expect(result.title).toBe("sample");
    expect(result.markdown).toBe(buffer.toString("utf-8"));
  });
});
