import { Eye, HelpCircle, Table2 } from "lucide-react";
import type { LineageNode } from "./types";

/** Shared between DecompositionTree and LineageCanvas so both card styles stay in sync. */
export const ITEM_TYPE_COLOR: Record<string, string> = {
    Lakehouse: "var(--color-lineage-lakehouse)",
    Warehouse: "var(--color-lineage-warehouse)",
};

/** SQL dialect keyed by item type, for formatting a node's `viewDefinition` (sql-formatter's `language` option). */
const SQL_DIALECT_BY_ITEM_TYPE: Record<string, string> = {
    Lakehouse: "spark",
    Warehouse: "tsql",
};

export function sqlDialectForItemType(itemType: string): string {
    return SQL_DIALECT_BY_ITEM_TYPE[itemType] ?? "sql";
}

export function objectTypeIcon(objectType: string) {
    if (objectType === "VIEW") return Eye;
    if (objectType === "USER_TABLE") return Table2;
    return HelpCircle;
}

export function plural(count: number): string {
    return count === 1 ? "" : "s";
}

/**
 * Strips the extractor's `#OBJECT_TYPE` disambiguation suffix (added only when a
 * table and its same-named view would otherwise share one node_id) for display —
 * the suffix is part of the graph's join key, not the object's real identifier.
 */
export function displayNodeId(id: string): string {
    return id.endsWith("#VIEW") ? id.slice(0, -"#VIEW".length)
        : id.endsWith("#USER_TABLE") ? id.slice(0, -"#USER_TABLE".length)
        : id;
}

/** Richer screen-reader announcement: name, type, and dependency counts (not just the visible label). */
export function describeCard(node: LineageNode): string {
    return (
        `${node.objectName}, ${node.objectType.toLowerCase()} in ${node.itemName}.${node.schemaName}. ` +
        `Depends on ${node.inDegree} object${plural(node.inDegree)}; ` +
        `${node.outDegree} object${plural(node.outDegree)} depend${node.outDegree === 1 ? "s" : ""} on it.`
    );
}
