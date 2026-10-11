import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const TESTS_DIR = __dirname;
const SRC_DIR = path.resolve(__dirname, "../src");

// `vi.mock("<path>"` and `vi.doMock("<path>"`, single or double quoted.
const MOCK_CALL = /\bvi\.(?:do)?[Mm]ock\(\s*["']([^"']+)["']/g;

function testFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return testFiles(full);
    return /\.test\.tsx?$/.test(entry) ? [full] : [];
  });
}

/**
 * The same resolution vitest does: `@` is src, and a bare path may be .ts, .tsx or an
 * index file.
 */
function resolves(specifier: string): boolean {
  if (!specifier.startsWith("@/")) return true; // node_modules, not ours to check
  const base = path.join(SRC_DIR, specifier.slice(2));
  return [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ].some((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

const mocks = testFiles(TESTS_DIR).flatMap((file) => {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(MOCK_CALL)].map((match) => ({
    file: path.relative(path.resolve(__dirname, ".."), file),
    specifier: match[1],
  }));
});

describe("vi.mock paths", () => {
  it("finds the mock calls at all, so an empty pass is not mistaken for a green one", () => {
    expect(mocks.length).toBeGreaterThan(0);
  });

  it.each(mocks)("$file mocks $specifier, which exists", ({ specifier }) => {
    expect(resolves(specifier)).toBe(true);
  });
});
