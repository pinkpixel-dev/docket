import type { EngineInterface, Register } from 'claude-code'

import type { Docs, Tab } from './docs'
import { BG_HEX } from './cells'
import { FILE_NAMES, loadDocs } from './docs'
import { shortDate } from './parse'
import { body } from './view'

const PANE = 'docket'
const TABS: { tab: Tab; label: string; hotkey: string }[] = [
  { tab: 'roadmap', label: 'Roadmap', hotkey: '1' },
  { tab: 'decisions', label: 'Decisions', hotkey: '2' },
  { tab: 'errors', label: 'Errors', hotkey: '3' },
  { tab: 'changelog', label: 'Changelog', hotkey: '4' },
]
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit'])

let tab: Tab = 'roadmap'
let expanded: Partial<Record<Tab, number>> = {}
let docs: Docs | undefined

// A plain-text version of the open tab, for apps that can't draw a Raster.
function summary(d: Docs): string {
  switch (tab) {
    case 'roadmap':
      return (d.roadmap ?? []).map(s => `- **${s.title}**: ${s.done}/${s.done + s.open}`).join('\n') || 'No roadmap.'
    default: {
      const list = d[tab] ?? []
      return list.map(e => `- ${e.date === undefined ? '' : shortDate(e.date) + ' '}${e.title}`).join('\n') || 'Nothing logged.'
    }
  }
}

async function reload($: EngineInterface) {
  docs = await loadDocs(path => $.fs.read(path), await $.session.cwd())
  $.ui.invalidate('ui.render')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'docket', description: 'Open the project context pane' })
    return next(e)
  })

  on('command.run', { command: 'docket' }, async $ => {
    await reload($)
    await $.ui.open({ id: PANE, title: `docket · ${docs!.project}`, focus: true, closeOnEscape: true })
    return {}
  })

  // Keep the pane current when Claude edits one of the files it shows.
  on('tool.call', async ($, e, next) => {
    const res = await next(e)
    if (!docs || !EDIT_TOOLS.has(String(e.tool))) return res
    const path = 'file_path' in e ? String(e.file_path) : ''
    if (FILE_NAMES.has(path.split(/[\\/]/).at(-1) ?? '')) await reload($).catch(() => undefined)
    return res
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (!docs) docs = await loadDocs(path => $.fs.read(path), await $.session.cwd())
    const redraw = () => $.ui.invalidate('ui.render')
    const pick = (next: Tab) => {
      tab = next
      redraw()
    }

    if (e.surface !== 'terminal') {
      const { Markdown } = $.ui.resolve(e)
      return <Markdown text={`**${TABS.find(t => t.tab === tab)!.label}**\n\n${summary(docs)}`} />
    }

    const el = $.ui.resolve(e)
    const { Box, Button, Text } = el
    // The pane body's own width, inside the frame and the padding below.
    const cols = Math.max(20, e.props.bodyColumns - 2)
    const view = {
      tab,
      expanded,
      onExpand: (t: Tab, i: number) => {
        expanded = { ...expanded, [t]: expanded[t] === i ? undefined : i }
        redraw()
      },
    }

    return (
      <Box flexDirection="column" gap={1} paddingX={1} backgroundColor={BG_HEX} minHeight={e.props.scroll.bodyRows}>
        <Box key="tabs" flexDirection="row" columnGap={3}>
          {TABS.map(t => (
            <Button
              key={`tab-${t.tab}`}
              label={t.label}
              hotkey={t.hotkey}
              plain
              dimColor={t.tab !== tab}
              onPress={() => pick(t.tab)}
            />
          ))}
          <Button key="refresh" label="Refresh" hotkey="r" plain dimColor onPress={() => reload($)} />
        </Box>
        {body(el, docs, view, cols, Date.now())}
        {docs.paths[tab] ? <Text key="src" dimColor>{docs.paths[tab]}</Text> : null}
      </Box>
    )
  })
}
