import type { LineageGraph } from "./types";

export interface LineageFilters {
    searchTerm: string;
    itemNames: Set<string>;
    objectTypes: Set<string>;
    crossItemOnly: boolean;
    /** When true, drops nodes in Fabric's built-in `queryinsights` monitoring schema. */
    hideSystemSchemas: boolean;
}

/** Fabric's auto-generated monitoring schema, present in every warehouse/lakehouse — not business data. */
const SYSTEM_SCHEMA_NAMES = new Set(["queryinsights"]);

/**
 * Applies the toolbar filters to a lineage graph. Search/item/type filters narrow
 * the node set first; edges then keep only those whose endpoints both survived.
 * `crossItemOnly` additionally drops same-item edges, then drops any node left
 * with no remaining edge (isolated nodes add noise once cross-item is the focus).
 */
export function filterLineageGraph(graph: LineageGraph, filters: LineageFilters): LineageGraph {
    const search = filters.searchTerm.trim().toLowerCase();

    const baseNodes = graph.nodes.filter((node) => {
        if (!filters.itemNames.has(node.itemName)) return false;
        if (!filters.objectTypes.has(node.objectType)) return false;
        if (filters.hideSystemSchemas && SYSTEM_SCHEMA_NAMES.has(node.schemaName.toLowerCase())) return false;
        if (search && !`${node.objectName} ${node.schemaName} ${node.itemName}`.toLowerCase().includes(search)) {
            return false;
        }
        return true;
    });
    const baseNodeIds = new Set(baseNodes.map((node) => node.id));

    const edges = graph.edges.filter((edge) => {
        if (!baseNodeIds.has(edge.source) || !baseNodeIds.has(edge.target)) return false;
        if (filters.crossItemOnly && !edge.isCrossItem) return false;
        return true;
    });

    if (!filters.crossItemOnly) {
        return { nodes: baseNodes, edges };
    }

    const touchedNodeIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
    return { nodes: baseNodes.filter((node) => touchedNodeIds.has(node.id)), edges };
}
