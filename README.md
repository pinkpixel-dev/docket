# docket

docket is a Claude Code mod that opens a project context pane. It reads the roadmap, decisions, errors, and changelog from your project's docs and draws each one with a small pixel visual on top.

I keep `DOCS/ROADMAP.md`, `DOCS/MEMORY.md`, `DOCS/ERRORS.md`, and `CHANGELOG.md` in pretty much every project, and I wanted to see where a project stands without opening four files.

## What it shows

Run `/docket` and a pane opens with four tabs:

| Tab | File | Visual |
|---|---|---|
| Roadmap | `DOCS/ROADMAP.md` | Overall percent done, plus a progress bar for each `##` section |
| Decisions | `DOCS/MEMORY.md` | A timeline with a dot for each dated entry |
| Errors | `DOCS/ERRORS.md` | The same timeline, in amber |
| Changelog | `CHANGELOG.md` | A GitHub-style calendar of releases over recent weeks |

The Decisions, Errors, and Changelog tabs list every entry newest first. Select one to expand its full text right in the pane.

If a file isn't in `DOCS/`, docket checks the project root next. For the changelog it checks the root first.

## Keys

| Key | What it does |
|---|---|
| `1` to `4` | Switch tabs |
| `r` | Read the files again |
| Tab, Enter | Move between entries and expand one |
| Page Up, Page Down | Scroll a long tab |
| Esc | Close the pane |

You usually won't need `r`. The pane reloads by itself when Claude edits one of the files it shows.

## How it reads your files

- **Roadmap sections** count `- [x]` and `- [ ]` checkboxes. A section with plain bullets and no checkboxes counts every item as done if its heading says something like "Done", "Completed", or "Shipped", and as open otherwise.
- **Entries** are the `##` headings. Dates can look like `2026-09-21` or `September 22, 2026`. If a heading is only a date, docket uses the first `###` under it as the title.

So a roadmap written as plain bullets under a heading like "Phase 1 - Current" shows up as all open, even if the work is finished. Checkboxes give the most accurate bars.

## Install

You need Claude Code v2.1.287 or later.

This repo is also a small plugin marketplace called `docket`, so you can install it straight from GitHub. Inside Claude Code:

```
/plugin marketplace add pinkpixel-dev/docket
/plugin install docket@docket
```

Or from your shell:

```bash
claude plugin marketplace add pinkpixel-dev/docket
claude plugin install docket@docket
```

If a session is already open, run `/reload-plugins` to load it. Then run `/docket` from inside any project.

Run `/plugin` and you should see `docket` in the `mods active` line under the tabs. To pick up new versions later, run `claude plugin marketplace update docket`.

### Load it from a local folder

If you've cloned the repo and want to hack on it, you can load it from the folder for one session instead:

```bash
git clone https://github.com/pinkpixel-dev/docket.git
claude --plugin-dir ./docket
```

Claude Code watches that folder, so saving a file reloads the mod.

## Where it works

The pixel visuals are Raster elements, and only the terminal draws those. In the Claude Desktop app the pane shows a plain text list of the current tab instead.

## Development

```bash
claude plugin validate .
claude plugin test .
```

The code lives in `hooks/`:

- `register.tsx` registers the command, the pane, and the tool hook that refreshes on edits
- `docs.ts` finds and loads the files
- `parse.ts` turns Markdown into sections and entries
- `cells.ts` packs bars, timelines, and the calendar into Raster cells
- `view.tsx` draws each tab

## License

Apache 2.0. See [LICENSE](LICENSE).

Made with 💖 by Pink Pixel
