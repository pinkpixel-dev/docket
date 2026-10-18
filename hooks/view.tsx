// The pane's tab bodies: a pixel visual on top, the file's content under it.
import type { Elements } from 'claude-code'

import { AMBER, PINK, bar, heatmap, timeline } from './cells'
import type { Docs, Tab } from './docs'
import type { Entry, Section } from './parse'
import { shortDate } from './parse'

type El = Elements['terminal']

export const TEXT = { dim: '#8a8a94', pink: '#f472b6', amber: '#f5b041' }

export type View = {
  tab: Tab
  // The open entry in each list tab, by its index.
  expanded: Partial<Record<Tab, number>>
  onExpand: (tab: Tab, index: number) => void
}

const TITLE_MAX = 30
const COUNT_W = 9
const MAX_WEEKS = 52

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, Math.max(1, max - 1)) + '…' : text
}

function missing({ Text }: El, tab: Tab, cols: number) {
  const where = { roadmap: 'DOCS/ROADMAP.md', decisions: 'DOCS/MEMORY.md', errors: 'DOCS/ERRORS.md', changelog: 'CHANGELOG.md' }[tab]
  return <Text dimColor wrap="truncate">{clip(`No ${where} in this project.`, cols)}</Text>
}

function roadmap(el: El, sections: Section[], cols: number) {
  const { Box, Text, Raster } = el
  const done = sections.reduce((n, s) => n + s.done, 0)
  const total = sections.reduce((n, s) => n + s.done + s.open, 0)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const titleW = Math.min(TITLE_MAX, Math.max(10, Math.floor(cols * 0.35)))
  const barW = Math.max(6, cols - titleW - COUNT_W - 2)

  return (
    <Box key="roadmap" flexDirection="column" gap={1}>
      <Box key="overall" flexDirection="column">
        <Box key="head" flexDirection="row" gap={1}>
          <Text key="pct" bold color={TEXT.pink}>{`${pct}%`}</Text>
          <Text key="of" dimColor>{`${done} of ${total} items done`}</Text>
        </Box>
        <Raster key="overall-bar" {...bar(done, total, Math.max(6, cols - 1))} />
      </Box>
      <Box key="sections" flexDirection="column">
        {sections.map((s, i) => (
          <Box key={`s${i}`} flexDirection="row" gap={1}>
            <Box key="t" width={titleW}>
              <Text wrap="truncate" dimColor={s.open === 0}>{clip(s.title, titleW)}</Text>
            </Box>
            <Raster key={`bar${i}`} {...bar(s.done, s.done + s.open, barW)} />
            <Text key="n" dimColor>{`${s.done}/${s.done + s.open}`}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function entryList(el: El, tab: Tab, entries: Entry[], view: View, cols: number) {
  const { Box, Text, Button, Markdown } = el
  const open = view.expanded[tab]
  return (
    <Box key="entries" flexDirection="column">
      {entries.map((entry, i) => (
        <Box key={`e${i}`} flexDirection="column">
          <Box key="row" flexDirection="row" gap={1}>
            <Text key="d" dimColor>{entry.date === undefined ? '          ' : shortDate(entry.date)}</Text>
            <Button
              key={`${tab}-${i}`}
              plain
              label={clip(`${open === i ? '▾' : '▸'} ${entry.title}`, Math.max(8, cols - 12))}
              onPress={() => view.onExpand(tab, i)}
            />
          </Box>
          {open === i && entry.body ? (
            <Box key="body" paddingLeft={2} paddingY={1}>
              <Markdown text={entry.body} />
            </Box>
          ) : null}
        </Box>
      ))}
    </Box>
  )
}

function timelineTab(el: El, tab: Tab, entries: Entry[], view: View, cols: number, color: number, noun: string) {
  const { Box, Text, Raster } = el
  const dates = entries.flatMap(e => (e.date === undefined ? [] : [e.date]))
  const width = Math.max(6, cols - 1)
  return (
    <Box key={tab} flexDirection="column" gap={1}>
      <Box key="viz" flexDirection="column">
        <Text key="count" bold color={color === AMBER ? TEXT.amber : TEXT.pink}>{`${entries.length} ${noun}`}</Text>
        <Raster key={`${tab}-line`} {...timeline(dates, width, color)} />
        {dates.length > 0 ? (
          <Box key="ends" flexDirection="row" justifyContent="space-between" width={width}>
            <Text key="a" dimColor>{shortDate(Math.min(...dates))}</Text>
            <Text key="b" dimColor>{shortDate(Math.max(...dates))}</Text>
          </Box>
        ) : null}
      </Box>
      {entryList(el, tab, entries, view, cols)}
    </Box>
  )
}

function changelogTab(el: El, entries: Entry[], view: View, cols: number, now: number) {
  const { Box, Text, Raster } = el
  const dates = entries.flatMap(e => (e.date === undefined ? [] : [e.date]))
  const weeks = Math.max(4, Math.min(MAX_WEEKS, Math.floor((cols - 1) / 2)))
  const latest = entries[0]
  return (
    <Box key="changelog" flexDirection="column" gap={1}>
      <Box key="viz" flexDirection="column">
        <Box key="head" flexDirection="row" gap={1}>
          <Text key="v" bold color={TEXT.pink}>{latest ? latest.title : 'No releases'}</Text>
          <Text key="n" dimColor>{`${entries.length} releases · last ${weeks} weeks`}</Text>
        </Box>
        <Raster key="changelog-heat" {...heatmap(dates, weeks, now)} />
      </Box>
      {entryList(el, 'changelog', entries, view, cols)}
    </Box>
  )
}

export function body(el: El, docs: Docs, view: View, cols: number, now: number) {
  switch (view.tab) {
    case 'roadmap':
      return docs.roadmap?.length ? roadmap(el, docs.roadmap, cols) : missing(el, 'roadmap', cols)
    case 'decisions':
      return docs.decisions ? timelineTab(el, 'decisions', docs.decisions, view, cols, PINK, 'decisions') : missing(el, 'decisions', cols)
    case 'errors':
      return docs.errors ? timelineTab(el, 'errors', docs.errors, view, cols, AMBER, 'logged errors') : missing(el, 'errors', cols)
    case 'changelog':
      return docs.changelog ? changelogTab(el, docs.changelog, view, cols, now) : missing(el, 'changelog', cols)
  }
}
