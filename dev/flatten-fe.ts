/** Copy the front-end sources into txt/ as flat .txt files, for tools that take neither nested folders nor .tsx. */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = join(ROOT, 'web');
const OUT = join(ROOT, 'txt');
const SKIP = new Set(['node_modules', 'dist']);
const EXTENSIONS = ['.ts', '.tsx', '.css', '.html'];

async function sources(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) found.push(...(await sources(path)));
    } else if (EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      found.push(path);
    }
  }

  return found;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const files = await sources(SOURCE);

for (const path of files) {
  // the desktop and phone builds share seven file names, so the folders have to survive in the name
  const rel = relative(SOURCE, path).split(sep).join('/');
  // the repo mixes CRLF and LF; a dump nobody compiles reads better with one ending throughout
  const body = (await readFile(path, 'utf8')).replaceAll('\r\n', '\n');
  await writeFile(join(OUT, `${rel.replaceAll('/', '__')}.txt`), `// web/${rel}\n\n${body}`);
}

console.log(`${files.length} files → txt/`);
