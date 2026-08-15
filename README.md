# Data Lineage

A Microsoft Fabric App that visualizes table/view dependency lineage across a Fabric
workspace — built on the [Rayfin](https://github.com/microsoft) Fabric Apps framework
(React + Vite + TypeScript), driven entirely by DAX queries against a Power BI semantic
model.

Given a semantic model that exposes a catalog of objects (tables/views) and the
dependencies between them, the app renders:

- **Canvas view** — an interactive force/hierarchy-style dependency graph
- **Tree view** — a decomposition tree rooted at each warehouse-layer view
- **Table view** — a flat, sortable list of every upstream → downstream edge

with search, per-item and per-object-type filtering, a "cross-item only" toggle, a
"hide system schemas" toggle, and a detail panel that shows a selected object's SQL
definition plus its upstream/downstream neighbors and full impact radius (via BFS).

This repo is self-contained end to end: it includes the Fabric notebook that
extracts the metadata this app runs on, not just the app itself. You don't need
an existing catalog of your workspace's tables/views to start — you generate one.

## Prerequisites

- **Node.js v22** — https://nodejs.org/dist/v22.22.2/node-v22.22.2-x64.msi
- **Azure CLI**, signed in (`az login`) with an account that has access to the target
  Fabric tenant/workspace
- **Rayfin CLI** access (`npx rayfin login`) — same account
- A Fabric workspace with at least one Lakehouse or Warehouse containing views —
  that's the only thing the notebook in step 0 below needs to already exist

## How to run these steps

Every command in this README and in `TEMPLATE.md` is meant to be handed to an AI
coding agent (Claude Code, GitHub Copilot CLI, Codex, etc.) working inside this
repo — open the repo in your agent of choice and ask it to follow the steps
below, rather than typing them into a terminal yourself. That's how this
project itself was built and deployed. No special terminal setup needed beyond
what the agent already has.

## Getting started

The full walkthrough — **[TEMPLATE.md](TEMPLATE.md)** — takes you from a bare Fabric
workspace to a running app in five steps:

0. **Run [`notebooks/extract-view-definitions.ipynb`](notebooks/extract-view-definitions.ipynb)** in Fabric — scans your Lakehouses/Warehouses and writes three metadata tables (`objects`, `dependencies`, `view_definitions`).
1. **Build a Direct Lake semantic model** in Fabric over those three tables (no relationships needed).
2. **Clone and configure this app** — commands below.
3. **Run it locally**, then **deploy it** as a Fabric App.

Steps 0–1 happen entirely in the Fabric portal; TEMPLATE.md covers exactly what
to configure and what each notebook cell does. Steps 2–3 are this repo:

```bash
git clone https://github.com/AbdulAlimPUST/Fabric-Data-Lineage-Rayfin-App
cd Fabric-Data-Lineage-Rayfin-App
npm install

az login
npx rayfin login

# fabric.yaml is gitignored (it holds workspace/item ids) — create it and
# point it at the semantic model from step 1.
npx fabric-app-data init
npx fabric-app-data add semanticModel lineageModel --workspace <your-workspace-id> --item <your-semantic-model-id>
npx fabric-app-data generate -o src/fabric.generated.ts

# First time: deploy once to create the Fabric App item — you don't create
# this yourself in the portal beforehand, `rayfin up` creates it.
npm run build
npx rayfin up -w "<your workspace name>" --yes
```

The app can only be exercised inside the Fabric portal's app-embed shell (it needs the
Fabric auth context) — you can't just browse to `localhost:5173` directly. For local
iteration after that first deploy: run `npm run dev`, then open the Fabric App item
`rayfin up` just created in the portal and append `&devUri=http://localhost:5173` to
its URL, which points the embed shell at your local dev server instead of the last
deployed build. Redeploy the same way (`npm run build && npx rayfin up`) whenever
you want to push a change live — see [Building & deploying](#building--deploying) below.

## Pointing this app at your own data

This app is data-source-agnostic by design — no workspace, item, or dataset id is
hardcoded in `src/`. Everything workspace-specific lives in `fabric.yaml` (as
Rayfin/`fabric-app-data` profiles) and is regenerated into
`src/fabric.generated.ts` at build time.

Read **[TEMPLATE.md](TEMPLATE.md)** for the full metadata contract the three tables
must satisfy (exact column names), what the included extraction notebook does cell by
cell, and the `fabric-app-data` commands to register a new profile and switch to it.

## Testing

```bash
npm test          # run once (vitest)
npm run test:watch
npm run lint
```

## Building & deploying

**You don't create the Fabric App item yourself first.** Pointing the app at a
semantic model (the steps above) and deploying it are completely independent —
`npx rayfin up` creates the Fabric App item automatically the first time you
run it, in whichever workspace you tell it to, and updates that same item on
every run after that:

```bash
npm run build        # regenerate fabric.generated.ts, typecheck, vite build
npx rayfin up -w "<workspace name>"   # first run: creates the Fabric App item. later runs: updates it.
```

`npx rayfin up` creates or updates the Rayfin item, uploads the static build, and
registers the resulting hosting URL as an allowed auth redirect URI (`rayfin/rayfin.yml`).

## Project structure

```
fabric.yaml                # Connection profiles (workspace/item ids) — gitignored, see TEMPLATE.md
notebooks/
└── extract-view-definitions.ipynb  # Fabric PySpark notebook — produces the 3 metadata tables
src/
├── fabric.generated.ts    # Auto-generated from fabric.yaml — gitignored
├── main.tsx / App.tsx     # App entry + layout
├── components/lineage/    # Canvas, decomposition tree, table, filters, detail panel
├── hooks/                 # Data fetching (useLineageGraph, useSemanticModelQuery), theming
├── lib/lineage/           # build-graph, filter-graph, impact-trace, layout algorithms
└── queries/lineage/       # .dax queries + factory functions for objects/dependencies/view_definitions
```

See **[AGENTS.md](AGENTS.md)** for the fuller architectural walkthrough and the
conventions used for query/spec organization — it's written for AI coding agents but
doubles as a developer-oriented design doc.

## License

MIT — see [LICENSE](LICENSE). Derived from Microsoft's Fabric Apps Analytics starter
template.
