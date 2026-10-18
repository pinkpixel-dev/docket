// Finds and reads the project's context files from the session's directory.

import type { Entry, Section } from './parse'
import { parseEntries, parseRoadmap } from './parse'

export type Tab = 'roadmap' | 'decisions' | 'errors' | 'changelog'

export type Docs = {
  project: string
  roadmap?: Section[]
  decisions?: Entry[]
  errors?: Entry[]
  changelog?: Entry[]
  // Which file each tab came from, to show and to match edits against.
  paths: Partial<Record<Tab, string>>
}

// Where each file usually lives, first match wins.
export const CANDIDATES: Record<Tab, string[]> = {
  roadmap: ['DOCS/ROADMAP.md', 'ROADMAP.md'],
  decisions: ['DOCS/MEMORY.md', 'MEMORY.md'],
  errors: ['DOCS/ERRORS.md', 'ERRORS.md'],
  changelog: ['CHANGELOG.md', 'DOCS/CHANGELOG.md'],
}

export const FILE_NAMES = new Set(Object.values(CANDIDATES).flat().map(p => p.split('/').at(-1)!))

type Read = (path: string) => Promise<string>

async function first(read: Read, paths: string[]): Promise<{ path: string; text: string } | undefined> {
  for (const path of paths) {
    const text = await read(path).catch(() => undefined)
    if (text !== undefined) return { path, text }
  }
  return undefined
}

export async function loadDocs(read: Read, cwd: string): Promise<Docs> {
  const [roadmap, decisions, errors, changelog] = await Promise.all(
    (['roadmap', 'decisions', 'errors', 'changelog'] as const).map(tab => first(read, CANDIDATES[tab])),
  )
  return {
    project: cwd.split(/[\\/]/).filter(Boolean).at(-1) ?? cwd,
    roadmap: roadmap && parseRoadmap(roadmap.text),
    decisions: decisions && parseEntries(decisions.text),
    errors: errors && parseEntries(errors.text),
    changelog: changelog && parseEntries(changelog.text),
    paths: { roadmap: roadmap?.path, decisions: decisions?.path, errors: errors?.path, changelog: changelog?.path },
  }
}
