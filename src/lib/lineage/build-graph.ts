import type { QueryTable } from "@microsoft/fabric-app-data";
import type { LineageEdge, LineageGraph, LineageNode } from "./types";

/** Returns a `columnName -> rowValue` accessor for a single row of a `QueryTable`. */
function rowAccessor(table: QueryTable, row: unknown[]) {
    const indexByName = new Map(table.columns.map((col, i) => [col.name, i]));
    return (columnName: string): unknown => {
        const index = indexByName.get(columnName);
        return index === undefined ? undefined : row[index];
    };
}

function asString(value: unknown): string {
    return value == null ? "" : String(value);
}

function asDate(value: unknown): Date | null {
    if (value == null) return null;
    const date = new Date(value as string);
    return Number.isNaN(date.getTime()) ? null : date;
}

function asBoolean(value: unknown): boolean {
    return value === true || value === 1 || value === "true" || value === "1";
}

/**
 * Joins the three metadata tables (objects, dependencies, view_definitions) into a
 * single node/edge lineage graph. Nodes are keyed by the catalog's `node_id`
 * (`{item}.{schema}.{object}`, occasionally suffixed `#OBJECT_TYPE` when a table and
 * its same-named view would otherwise collide); edges connect `source_node_id`
 * (falling back to `source_id`) upstream -> `target_id` downstream. Dependency
 * endpoints that have no matching objects row are kept as placeholder nodes so the
 * graph never silently drops an edge — labeled with `resolved_type` (e.g. `NOT_FOUND`,
 * `OUT_OF_SCAN_SCOPE`) when the extractor recorded why it couldn't resolve the
 * reference, falling back to a generic `UNKNOWN`.
 */
export function buildLineageGraph(
    objectsTable: QueryTable,
    dependenciesTable: QueryTable,
    viewDefinitionsTable: QueryTable,
): LineageGraph {
    const viewDefinitionByNodeId = new Map<string, string>();
    for (const row of viewDefinitionsTable.rows) {
        const get = rowAccessor(viewDefinitionsTable, row);
        const nodeId = asString(get("view_definitions[node_id]"));
        const definition = asString(get("view_definitions[view_definition]"));
        if (nodeId) viewDefinitionByNodeId.set(nodeId, definition);
    }

    const nodesById = new Map<string, LineageNode>();
    for (const row of objectsTable.rows) {
        const get = rowAccessor(objectsTable, row);
        const id = asString(get("objects[node_id]"));
        if (!id) continue;
        nodesById.set(id, {
            id,
            itemName: asString(get("objects[item_name]")),
            itemType: asString(get("objects[item_type]")),
            schemaName: asString(get("objects[schema_name]")),
            objectName: asString(get("objects[object_name]")),
            objectType: asString(get("objects[object_type]")),
            createdAt: asDate(get("objects[created_at]")),
            modifiedAt: asDate(get("objects[modified_at]")),
            viewDefinition: viewDefinitionByNodeId.get(id) ?? null,
            isPlaceholder: false,
            inDegree: 0,
            outDegree: 0,
        });
    }

    /** Synthesizes a minimal node for a dependency endpoint missing from objects. */
    function ensureNode(id: string, unresolvedType?: string): LineageNode {
        const existing = nodesById.get(id);
        if (existing) return existing;

        const [itemName = id, schemaName = "", objectName = ""] = id.split(".");
        const placeholder: LineageNode = {
            id,
            itemName,
            itemType: "",
            schemaName,
            objectName: objectName || id,
            objectType: unresolvedType || "UNKNOWN",
            createdAt: null,
            modifiedAt: null,
            viewDefinition: null,
            isPlaceholder: true,
            inDegree: 0,
            outDegree: 0,
        };
        nodesById.set(id, placeholder);
        return placeholder;
    }

    const edges: LineageEdge[] = [];
    dependenciesTable.rows.forEach((row, index) => {
        const get = rowAccessor(dependenciesTable, row);
        // source_node_id is the extractor's exact-resolved node_id (populated whenever
        // match_kind is EXACT or CASE_MISMATCH) — join on it, not source_id, because a
        // table and its same-named view share one {item}.{schema}.{object} id, so the
        // extractor disambiguates node_id with an `#OBJECT_TYPE` suffix for that pair.
        // source_id is only the best-effort name as written in the SQL and won't carry
        // that suffix. Fall back to source_id when source_node_id is blank (NOT_FOUND /
        // OUT_OF_SCAN_SCOPE / AMBIGUOUS_CASE), where there's no resolved object anyway.
        const sourceNodeId = asString(get("dependencies[source_node_id]"));
        const source = sourceNodeId || asString(get("dependencies[source_id]"));
        const target = asString(get("dependencies[target_id]"));
        if (!source || !target) return;

        // Only the upstream ("referenced") side can fail to resolve — the downstream
        // ("referencing") side is always a real, scanned object. `resolved_type` holds
        // the real object type on a match, or a reason code (e.g. NOT_FOUND,
        // OUT_OF_SCAN_SCOPE) when the extractor couldn't confirm a catalog match.
        const resolvedType = asString(get("dependencies[resolved_type]"));
        ensureNode(source, resolvedType).outDegree += 1;
        ensureNode(target).inDegree += 1;

        edges.push({
            id: `${source}=>${target}#${index}`,
            source,
            target,
            itemName: asString(get("dependencies[item_name]")),
            referencingObject: asString(get("dependencies[referencing_object]")),
            referencedObject: asString(get("dependencies[referenced_object]")),
            referencedType: asString(get("dependencies[referenced_type]")),
            isCrossItem: asBoolean(get("dependencies[is_cross_item]")),
            isAmbiguous: asBoolean(get("dependencies[is_ambiguous]")),
        });
    });

    return { nodes: Array.from(nodesById.values()), edges };
}
