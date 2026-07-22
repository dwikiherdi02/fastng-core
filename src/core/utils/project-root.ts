import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

let cached: string | null = null

/**
 * Walk up from this file until we find the directory containing package.json
 * (the project root). Used by anything that must reach files outside `src/`,
 * e.g. `prisma/` schema fragments, migrations, and module seeder discovery.
 */
export function findProjectRoot(): string {
  if (cached) return cached

  let dir = path.dirname(fileURLToPath(import.meta.url))
  while (!fs.existsSync(path.join(dir, 'package.json'))) {
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error('Could not locate project root (package.json not found).')
    dir = parent
  }

  cached = dir
  return dir
}
