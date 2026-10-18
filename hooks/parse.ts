// Turns the Markdown in a project's DOCS into the small shapes the pane draws.

export type Section = { title: string; done: number; open: number }

export type Entry = { title: string; date?: number; body: string }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const ISO = /(\d{4})-(\d{2})-(\d{2})/
const LONG = /\b([A-Z][a-z]+)\.? (\d{1,2}),? (\d{4})\b/
const DONE_HEADING = /\b(done|complete[d]?|shipped|released|finished)\b|[✅✔✓]/i
const CHECKED = /^\s*[-*+] \[[xX]\]/
const UNCHECKED = /^\s*[-*+] \[ \]/
// Top-level items only, so sub-bullets don't inflate a plain list.
const TOP_ITEM = /^(?:[-*+]|\d+\.) \S/

/** The UTC midnight of the first date in `text`, as `2026-09-21` or `September 22, 2026`. */
export function parseDate(text: string): number | undefined {
  const iso = text.match(ISO)
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const long = text.match(LONG)
  if (!long) return undefined
  const month = MONTHS.indexOf(long[1]!.slice(0, 3).toLowerCase())
  return month < 0 ? undefined : Date.UTC(Number(long[3]), month, Number(long[2]))
}

/** Splits Markdown at its `##` headings, skipping anything above the first one. */
function chunks(md: string): { heading: string; lines: string[] }[] {
  const out: { heading: string; lines: string[] }[] = []
  for (const line of md.split('\n')) {
    const h = line.match(/^## (.+)/)
    if (h) out.push({ heading: h[1]!.trim(), lines: [] })
    else out.at(-1)?.lines.push(line)
  }
  return out
}

/**
 * Counts the roadmap items in each `##` section. Checkboxes count as done or
 * open; a section of plain bullets counts as done when its heading says so.
 */
export function parseRoadmap(md: string): Section[] {
  return chunks(md)
    .map(({ heading, lines }) => {
      const done = lines.filter(l => CHECKED.test(l)).length
      const open = lines.filter(l => UNCHECKED.test(l)).length
      if (done + open > 0) return { title: heading, done, open }
      const items = lines.filter(l => TOP_ITEM.test(l)).length
      return DONE_HEADING.test(heading) ? { title: heading, done: items, open: 0 } : { title: heading, done: 0, open: items }
    })
    .filter(s => s.done + s.open > 0)
}

/**
 * Drops the date and the separator around it, so `2026-09-21: Pick a db`
 * reads `Pick a db`. A heading that is only a date takes its first `###`
 * instead, with a count of the rest.
 */
function titleOf(heading: string, lines: string[]): string {
  const bare = heading
    .replace(ISO, '')
    .replace(LONG, '')
    .replace(/^[\s:\-–|·]+|[\s:\-–|·]+$/g, '')
  if (bare) return bare
  const subs = lines.flatMap(l => l.match(/^### (.+)/)?.[1]?.trim() ?? [])
  if (subs.length === 0) return heading
  return subs.length > 1 ? `${subs[0]} +${subs.length - 1}` : subs[0]!
}

/** One entry per `##` heading, newest first when dated, its body without trailing rules. */
export function parseEntries(md: string): Entry[] {
  const entries = chunks(md).map(({ heading, lines }) => ({
    title: titleOf(heading, lines),
    date: parseDate(heading),
    body: lines.join('\n').replace(/(\s*\n---\s*)+$/, '').trim(),
  }))
  // Stable sort keeps file order among undated entries, which sink to the end.
  return entries
    .map((entry, i) => ({ entry, i }))
    .sort((a, b) => (b.entry.date ?? -Infinity) - (a.entry.date ?? -Infinity) || a.i - b.i)
    .map(({ entry }) => entry)
}

export function shortDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}
