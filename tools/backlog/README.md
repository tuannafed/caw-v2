# backlog

Astro + React + shadcn UI app that renders caw stories
(`docs/caw/stories/<story-id>/`) as a stage-based Kanban board.

> **Status source.** The board scans `docs/caw/stories/<story-id>/` (story ids are
> `US-NNN-slug`; stories grouped under `stories/epics/E<NN>/` are traversed too). For
> each story it reads `plan.md` / `overview.yaml`, then **overlays status + lane from
> `harness.db`** when present — the DB is caw v2's source of truth ("what agents did").
> If `harness.db` is absent it falls back to the markdown `status:`. So the board
> reflects real execution state, not a stale mirror. This viewer is an **optional**
> companion — it ships outside `plugins/caw/` and is not installed with the plugin.
>
> Runs on **localhost only** by default (`host: 127.0.0.1`); the API routes have no
> server-side auth. Set `HOST=0.0.0.0` to opt into LAN access (not recommended).

## Stack

- **Astro 5** (SSR via `@astrojs/node`)
- **React 19** via `@astrojs/react`
- **Tailwind CSS 4** + **shadcn UI** components (Radix primitives + cva)
- **lucide-react** icons
- **marked** for rendering task stage markdown

## Run

Two build targets share one source tree.

### Local (live SSR — default)

Live filesystem read of `docs/caw/stories/`. Polling + SSE updates the
UI as you commit caw work.

```bash
cd backlog
pnpm install
CAW_PROJECT_ROOT="$(pwd)/.." pnpm dev
# open http://localhost:4321
```

`CAW_PROJECT_ROOT` defaults to the current working directory if unset.

### Vercel (static snapshot)

`DEPLOY_TARGET=vercel` flips every API route to `prerender = true`. Astro
walks `docs/caw/` at build time and emits flat JSON files into
`.vercel/output/static/api/*.json` — no serverless functions, no runtime
filesystem access.

```bash
pnpm build:vercel
# output: ../.vercel/output/  (copied to repo root for Vercel pickup)
```

**Deploy:** Connect the repo gốc to Vercel. The `vercel.json` at repo root
already points Vercel to run `pnpm build:vercel` inside this folder. Every
push to the linked branch rebuilds the snapshot.

Static mode trade-offs:

- No live updates — UI is frozen at the commit Vercel built from.
- `/api/events` (SSE) and `/api/system.json` are inert stubs.
- No auth — anything in `docs/caw/` is publicly visible.

> **Why pnpm?** npm has a known bug with optional dependencies
> ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) that prevents
> platform-specific native binaries from installing
> (`@rollup/rollup-darwin-arm64`, `@tailwindcss/oxide-darwin-arm64`,
> `lightningcss-darwin-arm64`). pnpm handles them correctly.

## Data model

Each task folder holds one `overview.yaml` (structured state) plus four
stage markdown files. The parser reads `overview.yaml` as YAML; a folder
without `overview.yaml` is skipped as not a valid caw task.

| Field | Source |
|---|---|
| `status`     | `status:` in `overview.yaml` |
| `lane`       | `lane:` in `overview.yaml` (`tiny` / `standard` / `risky`) |
| `type`       | `type:` in `overview.yaml` |
| `next_phase` | `next_phase:` in `overview.yaml` |
| `phases[]`   | `phases:` list in `overview.yaml` |
| `sections.{plan,code,tests,review}` | `plan.md`, `code.md`, `tests.md`, `review.md` |
| `sections.overview` | raw `overview.yaml` content |

The status→stage mapping (Pending → Planning → Coding → Testing → Review →
Blocked → Done) lives in [src/lib/status.ts](src/lib/status.ts).

## Layout

```
src/
├── pages/
│   ├── index.astro              # Shell <html> → <App client:load />
│   └── api/
│       ├── tasks.json.ts        # GET /api/tasks.json — parse CAW_PROJECT_ROOT tasks
│       └── project.json.ts      # GET /api/project.json — { name, root }
├── components/
│   ├── app.tsx                  # Root: polling + view routing + dialog state
│   ├── tasks-sidebar.tsx        # shadcn sidebar (Dashboard / Board nav)
│   ├── tasks-header.tsx         # Top bar with live indicator
│   ├── stats-cards.tsx          # Totals (Total / In Progress / Done / Blocked)
│   ├── tasks-board.tsx          # Kanban container
│   ├── task-column.tsx          # Stage column
│   ├── task-card.tsx            # Task card with lane + phase progress
│   ├── task-dialog.tsx          # Detail dialog: tabs for stage markdown files
│   ├── dashboard.tsx            # Dashboard view (stats + board)
│   └── ui/                      # shadcn primitives: button, badge, dialog,
│                                # tabs, sidebar, sheet, separator, …
├── lib/
│   ├── utils.ts                 # cn() — clsx + tailwind-merge
│   ├── task-parser.ts           # Node-side parser (fs + regex)
│   ├── status.ts                # Status→stage mapping, stats, colors
│   └── markdown.ts              # marked wrapper
├── hooks/
│   └── use-mobile.ts            # Mobile breakpoint hook for sidebar
└── styles/
    └── globals.css              # Tailwind + shadcn CSS variables + prose-task
```

## Dev notes

- API endpoints (`/api/*`) opt out of prerendering (`export const prerender = false`),
  so they run server-side at request time and re-read task files on every call.
- The app polls `/api/tasks.json` every 3s and flashes the "Live" indicator on
  changes (hash-based diff to avoid unnecessary re-renders).
- Hash routing: `#/` → Dashboard, `#/board` → Board.
- Dark mode only (class="dark" on `<html>`).

## Customizing

shadcn components are committed in [src/components/ui/](src/components/ui/) —
edit them like normal source. New primitives can be added via
`npx shadcn add <name>` once the local install is in place.
