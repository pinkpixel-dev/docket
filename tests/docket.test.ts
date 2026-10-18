import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { bar, heatmap, pack, timeline } from '../hooks/cells'
import { parseDate, parseEntries, parseRoadmap } from '../hooks/parse'

// The runtime has the ES2026 base64 methods; es2023's lib doesn't declare them.
declare global {
  interface Uint8ArrayConstructor {
    fromBase64(text: string): Uint8Array
  }
}

// The pane's own props don't matter to what docket draws.
const PANE = { plugin: 'docket', component: 'Pane', requestId: 'docket', props: { title: 'docket', bodyColumns: 98, scroll: { bodyRows: 30 } } as never } as const

const FILES: Record<string, string> = {
  'DOCS/ROADMAP.md': '## Done\n- a\n- b\n## Next\n- [ ] c',
  'DOCS/MEMORY.md': '## 2026-09-21: Pick a db\nSQLite.',
  'CHANGELOG.md': '## 0.2.0 - October 1, 2026\n- new\n## 0.1.0 - September 2, 2026\n- first',
}

// Answers the calls docket makes, with a project that has no ERRORS.md.
function stubProject(on: On) {
  on('session.cwd', () => ({ value: '/work/demo' }))
  on('fs.read', ($, e) => {
    const hit = Object.keys(FILES).find(path => e.path.endsWith('/' + path))
    return hit ? { value: FILES[hit]! } : { deny: 'ENOENT' }
  })
}

function decode(cells: string): number[] {
  return Array.from(new Uint32Array(Uint8Array.fromBase64(cells).buffer))
}

test('dates parse from both heading styles', () => {
  expect(parseDate('2026-09-21: Architecture')).toBe(Date.UTC(2026, 8, 21))
  expect(parseDate('0.7.0 - September 22, 2026')).toBe(Date.UTC(2026, 8, 22))
  expect(parseDate('Sept. 3, 2026')).toBe(Date.UTC(2026, 8, 3))
  expect(parseDate('Unreleased')).toBeUndefined()
})

test('roadmap sections count checkboxes, or plain bullets by heading', () => {
  const md = [
    '# Roadmap',
    '- ignored, above the first section',
    '## Phase 1',
    '- [x] one',
    '- [x] two',
    '  - [ ] nested still counts',
    '## Done',
    '- shipped a',
    '  - sub-bullet skipped',
    '1. shipped b',
    '## Next',
    '* idea',
    '## Phase 0 ✅',
    '- old thing',
    '## Notes',
    'Just prose.',
  ].join('\n')
  expect(parseRoadmap(md)).toEqual([
    { title: 'Phase 1', done: 2, open: 1 },
    { title: 'Done', done: 2, open: 0 },
    { title: 'Next', done: 0, open: 1 },
    { title: 'Phase 0 ✅', done: 1, open: 0 },
  ])
})

test('entries sort newest first and drop the date from the title', () => {
  const md = [
    '# Memory',
    '## 2026-09-01: Older pick',
    'Body one.',
    '',
    '---',
    '## Undated note',
    'Body two.',
    '## 2026-09-21: Newer pick',
    '### Decision',
    'Body three.',
  ].join('\n')
  const entries = parseEntries(md)
  expect(entries.map(e => e.title)).toEqual(['Newer pick', 'Older pick', 'Undated note'])
  expect(entries[1]!.body).toBe('Body one.')
  expect(entries[0]!.body).toContain('### Decision')
  expect(parseEntries('## 0.7.0 - September 22, 2026\n- x')[0]!.title).toBe('0.7.0')
  expect(parseEntries('## 2026-08-11\n### Decision: A\n### Decision: B')[0]!.title).toBe('Decision: A +1')
})

test('a bar fills in proportion and spans its width', () => {
  const g = bar(1, 4, 8)
  expect(g.columns).toBe(8)
  const colors = decode(g.cells).filter((_, i) => i % 3 === 1)
  expect(colors.filter(c => c === colors[0]).length).toBe(2)
  expect(bar(0, 0, 5).columns).toBe(5)
})

test('a timeline marks the ends and stacks shared cells', () => {
  const day = 86_400_000
  const g = timeline([0, 0, 10 * day], 11, 0xff0000)
  const chars = decode(g.cells).filter((_, i) => i % 3 === 0).map(c => String.fromCodePoint(c))
  expect(chars[0]).toBe('◆')
  expect(chars[10]).toBe('●')
  expect(chars[5]).toBe('─')
})

test('a heatmap is seven rows of day and gap cells, blank after today', () => {
  const today = Date.UTC(2026, 9, 14) // a Wednesday
  const g = heatmap([today, today], 3, today)
  expect(g.rows).toBe(7)
  expect(g.columns).toBe(6)
  const words = decode(g.cells)
  // Saturday of the last week is still ahead, so it draws blank.
  const saturdayLast = (6 * 6 + 4) * 3
  expect(String.fromCodePoint(words[saturdayLast]!)).toBe(' ')
  expect(pack([]).columns).toBe(0)
})

test('the pane draws each tab from the project files', async ($, on) => {
  stubProject(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 100, rows: 40 } })
  expect(await ui.find({ type: 'Text', text: '67%' })).toBeDefined()
  expect(await ui.find({ key: 'bar1' })).toBeDefined()

  await ui.press({ key: 'tab-decisions' })
  expect(await ui.find({ key: 'decisions-line' })).toBeDefined()
  await ui.press({ key: 'decisions-0' })
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()

  await ui.press({ key: 'tab-errors' })
  expect(await ui.find({ type: 'Text', text: /No DOCS\/ERRORS\.md/ })).toBeDefined()

  await ui.press({ key: 'tab-changelog' })
  expect(await ui.find({ key: 'changelog-heat' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '0.2.0' })).toBeDefined()
  await ui.unmount()
})

test('the desktop app gets a text summary instead of Rasters', async ($, on) => {
  stubProject(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', viewport: { columns: 100, rows: 40 } })
  expect(await ui.find({ type: 'Markdown' })).toBeDefined()
  await ui.unmount()
})
