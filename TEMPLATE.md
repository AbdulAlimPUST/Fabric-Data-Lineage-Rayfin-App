# From view extraction to a deployed lineage app

This is the complete, ordered walkthrough — start to finish, in a fresh Fabric
workspace, with no prior setup. Follow it top to bottom:

0. **Run the extraction notebook** in Fabric → writes three metadata tables into a Lakehouse.
1. **Build a Direct Lake semantic model** in Fabric over those three tables.
2. **Point this app** at that semantic model.
3. **Run it locally, then deploy it** as a Fabric App.

Everything workspace-specific — which tenant, which Lakehouse, which semantic
model — lives in `fabric.yaml` (regenerated into `src/fabric.generated.ts` at
build time), not in `src/`. Nothing in the app's source code hardcodes a
workspace, item, or dataset id.

**How to run these steps:** hand this file to an AI coding agent (Claude Code,
GitHub Copilot CLI, Codex, etc.) working inside this repo and ask it to follow
the steps below — that's how this project was itself built and deployed. You
don't need to run anything in a terminal by hand.

## 0. Run the extraction notebook

The notebook is [`notebooks/extract-view-definitions.ipynb`](notebooks/extract-view-definitions.ipynb) —
import it into your Fabric workspace and run it there (it's a PySpark
notebook; it has to run inside Fabric, not locally).

**Before running it:**

- Attach a **default Lakehouse** to the notebook, and make sure that Lakehouse
  has **custom schemas enabled** — the notebook writes its output tables into a
  named schema (`metadata` by default), which requires schema support turned on.
- Cell 1 does `%pip install semantic-link-labs==0.15.2`. Inline `%pip` restarts
  the Python interpreter and is disabled in pipeline runs, so for anything
  beyond ad-hoc exploration, attach a custom Fabric Environment with
  `semantic-link-labs` pre-installed instead and delete cell 1.
- Open **Cell 2** and review the config before running:

  | Setting | Default | What it controls |
  |---|---|---|
  | `WORKSPACES` | `None` | `None` scans the notebook's own workspace. Pass names/GUIDs to scan others. |
  | `LAKEHOUSE_ALLOWLIST` | `[]` (all) | Restrict to specific Lakehouses/Warehouses by name or GUID. |
  | `INCLUDE_WAREHOUSES` | `True` | Also scan Fabric Warehouses, not just Lakehouses. |
  | `OUTPUT_SCHEMA` | `"metadata"` | The schema the three output tables get written into. |
  | `WRITE_MODE` | `"overwrite"` | `"overwrite"` keeps a snapshot; `"append"` keeps history across runs. |
  | `SQL_EXPORT_FOLDER` | `"view_ddl"` | Also writes one `.sql` file per view under `Files/<folder>/<item>/<schema>/` — useful for diffing view changes in git. Set to `None` to skip. |
  | `DRY_RUN` | `False` | Set `True` first: it collects and prints what it would write without touching Delta tables. Confirm Cell 4's discovered endpoint list looks right before turning it off. |

**What it does, cell by cell:**

- **Cell 4** discovers every Lakehouse (and Warehouse, if enabled) in scope.
- **Cell 5** connects to each one's SQL analytics endpoint in parallel and pulls three raw result sets: view definitions (from `sys.sql_modules`, not `INFORMATION_SCHEMA.VIEWS` — the latter truncates at 4000 characters), objects (`sys.objects`, tables and views only), and dependencies (`sys.sql_expression_dependencies` — this is engine-resolved lineage, not SQL text parsing).
- **Cell 6** builds the `node_id` graph keys and resolves every dependency edge by name against everything discovered. This is where the `match_kind`/`resolved_type` values documented below come from, including the case-insensitive disambiguation (`#OBJECT_TYPE` suffix) needed because Direct Lake/Tabular collapses names that differ only by case.
- **Cell 7** writes the three Delta tables: `<OUTPUT_SCHEMA>.view_definitions`, `<OUTPUT_SCHEMA>.objects`, `<OUTPUT_SCHEMA>.dependencies`, in the attached default Lakehouse.
- **Cell 9** prints sanity checks after the run — ambiguous casing collisions, broken/missing references, items referenced but never scanned. Worth reading once after every run.

Run it now, against your own workspace, with `DRY_RUN = True` first, then
`False` once the discovered endpoints and row counts look right.

## 1. Build the semantic model — in Fabric, not Power BI Desktop

This project's app queries the model via **Direct Lake**, which is authored
directly in the Fabric workspace, not in Power BI Desktop:

1. Open the Lakehouse the notebook wrote to.
2. Use **New semantic model**, and add the three tables from the schema you
   configured (`metadata.objects`, `metadata.dependencies`, `metadata.view_definitions`
   by default).
3. **Do not add relationships between the three tables.** Leave them
   unrelated — the app queries each one independently via its own DAX query
   and joins them client-side (see `src/lib/lineage/build-graph.ts`).
4. Save it. Direct Lake means there's no import step and no refresh schedule
   to manage — the model reads the same OneLake Delta files the notebook just
   wrote.

## 2. The metadata contract

This section documents exactly what the notebook produces, in case you ever
need to point this app at a *different* extractor, or just want to understand
the shape of the data feeding it.

Table and column names are **case-sensitive and must match exactly** — the app looks
them up as literal strings (e.g. `dependencies[source_id]`), so a rename on the model
side (as happened here — the tables moved from `Objects`/`Dependencies`/`ViewDefinitions`
to `objects`/`dependencies`/`view_definitions`) requires updating every `.dax` file and
every `ColumnMetadataMap` key in `src/queries/lineage/*.ts`, plus the matching lookup
strings in `src/lib/lineage/build-graph.ts`.

### `objects` — one row per table/view in your estate

| Column | Type | Notes |
|---|---|---|
| `workspace_name` | text | |
| `workspace_id` | text | |
| `item_name` | text | Fabric item name (e.g. a Lakehouse or Warehouse name) |
| `item_type` | text | e.g. `Lakehouse`, `Warehouse` — drives the color legend and the "Warehouse + VIEW" auto-tree rule |
| `schema_name` | text | |
| `object_name` | text | |
| `object_type` | text | e.g. `VIEW`, `USER_TABLE` |
| `node_id` | text | **Must be unique.** Convention used here: `{item_name}.{schema_name}.{object_name}`. Power BI/Tabular compares text **case-insensitively**, so if your estate can have a table and a view share a name (e.g. table `entity` + view `Entity`), the plain three-part id isn't enough — the extractor here disambiguates by appending `#OBJECT_TYPE` (e.g. `...Entity#VIEW`) whenever two rows would otherwise collide case-insensitively. Only the colliding rows get the suffix; everything else keeps the plain id. |
| `created_at` | datetime | |
| `modified_at` | datetime | |
| `extracted_at_utc` | datetime | |

### `dependencies` — one row per upstream → downstream edge

| Column | Type | Notes |
|---|---|---|
| `workspace_name` / `workspace_id` / `item_name` / `item_type` | text | |
| `referencing_schema` / `referencing_object` / `referencing_type` | text | the downstream (consumer) side — always a real, scanned object |
| `referenced_db` / `referenced_schema` / `referenced_object` / `referenced_type` | text | the upstream (source) side as originally parsed; `referenced_type` is often the sentinel `UNRESOLVED` |
| `source_id` | text | upstream reference **as originally written** in the referencing object's SQL — always populated, even when unresolved, but is *not* guaranteed to equal the upstream object's real `node_id` (case can differ, and a disambiguated `node_id` carries a suffix this never does). Client-side fallback only — see `source_node_id`. |
| `target_id` | text | downstream `node_id`, **exact** — always equal to the referencing object's real `objects.node_id`, suffix included when that object was disambiguated |
| `is_cross_item` | boolean | true when source/target live in different Fabric items |
| `is_ambiguous` | boolean | reserved for parser ambiguity; not currently populated as `true` in this dataset |
| `extracted_at_utc` | datetime | |
| `resolved_type` | text | the upstream side's *actual* resolved object type (e.g. `USER_TABLE`, `VIEW`) when found, or a reason code (`NOT_FOUND`, `OUT_OF_SCAN_SCOPE`, `AMBIGUOUS_CASE`) when not. **Used as the placeholder node's object type** in `build-graph.ts` instead of a blanket `UNKNOWN`, so the type filter chips break unresolved references down by *why* they're unresolved. |
| `source_node_id` | text | the upstream object's **exact, disambiguated** `node_id` — populated whenever `match_kind` is `EXACT` or `CASE_MISMATCH`, blank otherwise (`NOT_FOUND` / `OUT_OF_SCOPE` / `AMBIGUOUS`). **This is the app's actual join key** (`build-graph.ts` prefers it, falling back to `source_id` only when blank) — required, not optional, the moment your estate has any node_id disambiguation. Populate it correctly or colliding table/view pairs will silently orphan in the graph. |
| `match_kind` | text | how the upstream reference was resolved: `EXACT` (name matched a real object's node_id exactly), `CASE_MISMATCH` (matched exactly one candidate after folding case), `AMBIGUOUS` (matched more than one candidate, or a collided name with no reliable type signal — never guessed), `NOT_FOUND`, `OUT_OF_SCOPE` |

An edge whose `source_node_id`/`source_id` or `target_id` doesn't match any `objects`
row is still rendered — the app synthesizes a placeholder node rather than dropping
the edge. `resolved_type` mostly explains *why*: `NOT_FOUND` means the extractor
genuinely couldn't match it (often extraction timing skew); `OUT_OF_SCAN_SCOPE`
mostly shows up on Fabric's own `queryinsights` system schema, which the "Hide system
schemas" toggle already filters out; `AMBIGUOUS_CASE` means the reference matched a
name that exists in more than one casing with no reliable way to tell which one was
meant — deliberately left unresolved rather than guessed.

### `view_definitions` — one row per view, for the SQL shown in the detail panel

| Column | Type | Notes |
|---|---|---|
| `workspace_name` / `workspace_id` / `item_name` / `item_type` / `schema_name` / `view_name` | text | |
| `node_id` | text | must match the corresponding `objects` row's `node_id` **exactly**, including the `#OBJECT_TYPE` suffix if that view was disambiguated |
| `view_definition` | text | the view's SQL |
| `created_at` / `modified_at` / `extracted_at_utc` | datetime | |

The exact DAX is a plain `EVALUATE 'table_name'` per table (see
`src/queries/lineage/*.dax`) — no filtering happens in DAX, so anything you want
hidden should either not be extracted in the first place, or be filtered client-side
(the "Hide system schemas" toggle in `src/lib/lineage/filter-graph.ts` is an example —
it currently hides Fabric's own `queryinsights` schema by name).

## 3. Point the app at your semantic model

The three query files (`src/queries/lineage/objects.ts`, `dependencies.ts`,
`view-definitions.ts`) all reference a connection **alias** called `lineageModel`.
That alias — not a hardcoded workspace/item id — is what resolves to the
semantic model you built in Step 1, via `fabric.yaml`.

**`fabric.yaml` is gitignored and will not exist after a fresh clone** — it holds
workspace/item ids, which are environment-specific and don't belong in git. Create
it locally first:

```bash
npx fabric-app-data init
```

This writes a `fabric.yaml` with an empty `dev` profile. Now add your semantic
model to it:

```bash
# --from-url also works: paste the model's URL from the Fabric portal instead
# of looking up the workspace/item ids yourself.
npx fabric-app-data add semanticModel lineageModel \
  --workspace <your-workspace-id> \
  --item <your-semantic-model-id>

# Generate the config the app actually reads at build/runtime.
npx fabric-app-data generate -o src/fabric.generated.ts
```

The result looks like this:

```yaml
# fabric.yaml
activeProfile: dev
profiles:
  dev:
    semanticModels:
      lineageModel:
        workspaceId: <your-workspace-id>
        itemId: <your-semantic-model-id>
```

To point the same clone at a **second** target later (keeping the first intact),
add another profile instead of hand-editing the alias:

```bash
npx fabric-app-data add semanticModel lineageModel \
  --workspace <their-workspace-id> \
  --item <their-semantic-model-id> \
  --profile contoso

# Switch to it (regenerates src/fabric.generated.ts automatically).
npx fabric-app-data use contoso
```

**The alias must stay `lineageModel`** — that string is what the three query files
look up. Using any other alias means editing those three files too.

## 4. Run it, then deploy it

**First time only** — deploy once to create the Fabric App item. You don't create
this item yourself in the portal beforehand; `rayfin up` creates it:

```bash
npm run build        # regenerates src/fabric.generated.ts from the active profile, then builds
npx rayfin up -w "<your workspace name>" --yes
```

**After that**, for local iteration: run the dev server, then open the Fabric App
item `rayfin up` just created in the portal and append `&devUri=http://localhost:5173`
to its URL — this points the deployed app's embed shell at your local dev server
instead of the last deployed build (see the main [README](README.md) for the full
embed-preview flow):

```bash
npm run dev
```

When you're happy with a change, redeploy the same way — `npx rayfin up` on the
same workspace updates the existing item rather than creating a new one:

```bash
npm run build
npx rayfin up -w "<your workspace name>" --yes
```

If instead you want a **wholly separate Fabric App** for another team (its own
Fabric item, URL, and publishable key — not just a different data source behind
this same app), start from a fresh `npm create @microsoft/rayfin` and copy
`notebooks/`, `src/lib/lineage/`, `src/components/lineage/`, and
`src/queries/lineage/` into it, then follow steps 0–4 above in the new project.

## What's already generic vs. what you might still want to change

- **Generic already:** the header subtitle, item/type filters, and the
  "every Warehouse VIEW gets its own tree" rule are all derived from whatever
  `Item Type`/`Object Type` values your data actually contains — no project names
  are hardcoded.
- **Cosmetic, edit if you want:** the `<title>` in `index.html`, the app name in
  `rayfin/rayfin.yml`, and the "Data Lineage" heading in
  `src/components/lineage/LineageApp.tsx` are branding, not configuration.
