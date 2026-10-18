# Changelog

## 0.1.0 - October 18, 2026

### 🗂️ Pane
- Added the `/docket` command, which opens a project context pane with Roadmap, Decisions, Errors, and Changelog tabs.
- Roadmap shows overall progress and a bar for each section, counted from checkboxes or from plain bullets under headings like "Done".
- Decisions and Errors show a timeline of dated entries, and each entry expands to its full text.
- Changelog shows a release calendar for recent weeks, and each release expands to its notes.
- The pane refreshes when Claude edits one of those files, or when you press `r`.
