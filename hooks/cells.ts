// Builds the packed cell strings the pane's Raster elements draw.

// The runtime has the ES2026 Uint8Array base64 methods; es2023's lib doesn't declare them.
declare global {
  interface Uint8Array {
    toBase64(): string
  }
}

export const DEFAULT = 0x01000000
// The pane's own background, so Raster cells match the Box behind them.
export const BG = 0x18181b
export const BG_HEX = '#18181b'
export const PINK = 0xf472b6
export const AMBER = 0xf5b041
export const TRACK = 0x3a3a42
export const AXIS = 0x4a4a52
// Heat steps from an empty day to a busy one.
export const HEAT = [0x2c2c33, 0x6e2f52, 0xa83f78, 0xe0609f, 0xf9b4d6]

const DAY = 86_400_000

export type Cell = [char: string, color: number, background?: number]

export type Grid = { columns: number; rows: number; cells: string }

/** Packs rows of cells into a Raster's size and base64 `cells`. */
export function pack(rows: Cell[][]): Grid {
  const columns = rows[0]?.length ?? 0
  const words = rows.flat().flatMap(([char, color, bg = BG]) => [char.codePointAt(0)!, color, bg])
  return { columns, rows: rows.length, cells: new Uint8Array(Uint32Array.from(words).buffer).toBase64() }
}

/** A one-row bar, `width` cells, filled in `color` for done out of total. */
export function bar(done: number, total: number, width: number, color = PINK): Grid {
  const filled = total > 0 ? Math.round((done / total) * width) : 0
  return pack([Array.from({ length: width }, (_, i): Cell => ['━', i < filled ? color : TRACK])])
}

/**
 * A one-row time axis from the first date to the last, with a marker where
 * each date falls. Two or more on one cell draw as a bigger marker.
 */
export function timeline(dates: number[], width: number, color: number): Grid {
  const row: Cell[] = Array.from({ length: width }, (): Cell => ['─', AXIS])
  if (dates.length === 0) return pack([row])
  const first = Math.min(...dates)
  const span = Math.max(...dates) - first
  const hits = new Array<number>(width).fill(0)
  for (const d of dates) hits[span === 0 ? width - 1 : Math.round(((d - first) / span) * (width - 1))]! += 1
  hits.forEach((n, i) => {
    if (n > 0) row[i] = [n > 1 ? '◆' : '●', color]
  })
  return pack([row])
}

/** Sunday 00:00 UTC of the week holding `ms`. */
function weekStart(ms: number): number {
  const day = Math.floor(ms / DAY) * DAY
  return day - new Date(day).getUTCDay() * DAY
}

/**
 * A GitHub-style calendar: seven rows, Sunday first, one column per week
 * ending with the week of `today`, each day shaded by how many dates land on it.
 * Each day is a block and a gap, so the grid is `weeks * 2` cells wide.
 */
export function heatmap(dates: number[], weeks: number, today: number): Grid {
  const start = weekStart(today) - (weeks - 1) * 7 * DAY
  const counts = new Map<number, number>()
  for (const d of dates) {
    const day = Math.floor(d / DAY) * DAY
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const last = Math.floor(today / DAY) * DAY
  const rows: Cell[][] = []
  for (let weekday = 0; weekday < 7; weekday++) {
    const row: Cell[] = []
    for (let w = 0; w < weeks; w++) {
      const day = start + (w * 7 + weekday) * DAY
      const n = counts.get(day) ?? 0
      row.push(day > last ? [' ', DEFAULT] : ['■', HEAT[Math.min(n, HEAT.length - 1)]!], [' ', DEFAULT])
    }
    rows.push(row)
  }
  return pack(rows)
}
