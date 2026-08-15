import { describe, expect, it } from "vitest";
import type { QueryTable } from "@microsoft/fabric-app-data";
import { buildLineageGraph } from "./build-graph";

function objectsTable(rows: unknown[][]): QueryTable {
    return {
        columns: [
            { name: "objects[workspace_name]", dataType: "String" },
            { name: "objects[workspace_id]", dataType: "String" },
            { name: "objects[item_name]", dataType: "String" },
            { name: "objects[item_type]", dataType: "String" },
            { name: "objects[schema_name]", dataType: "String" },
            { name: "objects[object_name]", dataType: "String" },
            { name: "objects[object_type]", dataType: "String" },
            { name: "objects[node_id]", dataType: "String" },
            { name: "objects[created_at]", dataType: "DateTime" },
            { name: "objects[modified_at]", dataType: "DateTime" },
            { name: "objects[extracted_at_utc]", dataType: "DateTime" },
        ],
        rows,
    };
}

function dependenciesTable(rows: unknown[][]): QueryTable {
    return {
        columns: [
            { name: "dependencies[workspace_name]", dataType: "String" },
            { name: "dependencies[workspace_id]", dataType: "String" },
            { name: "dependencies[item_name]", dataType: "String" },
            { name: "dependencies[item_type]", dataType: "String" },
            { name: "dependencies[referencing_schema]", dataType: "String" },
            { name: "dependencies[referencing_object]", dataType: "String" },
            { name: "dependencies[referencing_type]", dataType: "String" },
            { name: "dependencies[referenced_db]", dataType: "String" },
            { name: "dependencies[referenced_schema]", dataType: "String" },
            { name: "dependencies[referenced_object]", dataType: "String" },
            { name: "dependencies[referenced_type]", dataType: "String" },
            { name: "dependencies[source_id]", dataType: "String" },
            { name: "dependencies[target_id]", dataType: "String" },
            { name: "dependencies[is_cross_item]", dataType: "Boolean" },
            { name: "dependencies[is_ambiguous]", dataType: "Boolean" },
            { name: "dependencies[extracted_at_utc]", dataType: "DateTime" },
            { name: "dependencies[resolved_type]", dataType: "String" },
            { name: "dependencies[source_node_id]", dataType: "String" },
            { name: "dependencies[match_kind]", dataType: "String" },
        ],
        rows,
    };
}

function viewDefinitionsTable(rows: unknown[][]): QueryTable {
    return {
        columns: [
            { name: "view_definitions[workspace_name]", dataType: "String" },
            { name: "view_definitions[workspace_id]", dataType: "String" },
            { name: "view_definitions[item_name]", dataType: "String" },
            { name: "view_definitions[item_type]", dataType: "String" },
            { name: "view_definitions[schema_name]", dataType: "String" },
            { name: "view_definitions[view_name]", dataType: "String" },
            { name: "view_definitions[node_id]", dataType: "String" },
            { name: "view_definitions[created_at]", dataType: "DateTime" },
            { name: "view_definitions[modified_at]", dataType: "DateTime" },
            { name: "view_definitions[view_definition]", dataType: "String" },
            { name: "view_definitions[extracted_at_utc]", dataType: "DateTime" },
        ],
        rows,
    };
}

describe("buildLineageGraph", () => {
    it("joins objects, dependencies, and view definitions into a node/edge graph", () => {
        const objects = objectsTable([
            ["Phoenix Hub", "ws", "EDW", "Warehouse", "Finance", "GL Transaction", "VIEW", "EDW.Finance.GL Transaction", "2026-01-15", "2026-06-07", "2026-07-25"],
            ["Phoenix Hub", "ws", "Transform_LH", "Lakehouse", "Contoso", "GL Transaction", "USER_TABLE", "Transform_LH.Contoso.GL Transaction", "2026-01-01", "2026-01-01", "2026-07-25"],
        ]);
        const dependencies = dependenciesTable([
            [
                "Phoenix Hub", "ws", "EDW", "Warehouse", "Finance", "GL Transaction", "VIEW", "Transform_LH", "Contoso", "GL Transaction", "USER_TABLE",
                "Transform_LH.Contoso.GL Transaction", "EDW.Finance.GL Transaction", true, false, "2026-07-25",
                "USER_TABLE", "Transform_LH.Contoso.GL Transaction", "EXACT",
            ],
        ]);
        const viewDefinitions = viewDefinitionsTable([
            ["Phoenix Hub", "ws", "EDW", "Warehouse", "Finance", "GL Transaction", "EDW.Finance.GL Transaction", "2026-01-15", "2026-06-07", "CREATE VIEW Finance.[GL Transaction] AS SELECT * FROM ...", "2026-07-25"],
        ]);

        const graph = buildLineageGraph(objects, dependencies, viewDefinitions);

        expect(graph.nodes).toHaveLength(2);
        expect(graph.edges).toHaveLength(1);

        const view = graph.nodes.find((n) => n.id === "EDW.Finance.GL Transaction");
        expect(view?.viewDefinition).toContain("CREATE VIEW");
        expect(view?.inDegree).toBe(1);
        expect(view?.isPlaceholder).toBe(false);

        const table = graph.nodes.find((n) => n.id === "Transform_LH.Contoso.GL Transaction");
        expect(table?.outDegree).toBe(1);
        expect(table?.viewDefinition).toBeNull();

        expect(graph.edges[0]).toMatchObject({
            source: "Transform_LH.Contoso.GL Transaction",
            target: "EDW.Finance.GL Transaction",
            isCrossItem: true,
            isAmbiguous: false,
        });
    });

    it("synthesizes a placeholder node when a dependency endpoint has no matching objects row", () => {
        const dependencies = dependenciesTable([
            [
                "Phoenix Hub", "ws", "EDW", "Warehouse", "queryinsights", "exec_sessions_history", "VIEW", "EDW", "queryinsights", "fabric_sessions", "UNRESOLVED",
                "EDW.queryinsights.fabric_sessions", "EDW.queryinsights.exec_sessions_history", false, false, "2026-07-25",
                "OUT_OF_SCAN_SCOPE", "", "OUT_OF_SCOPE",
            ],
        ]);

        const graph = buildLineageGraph(objectsTable([]), dependencies, viewDefinitionsTable([]));

        expect(graph.nodes).toHaveLength(2);
        const placeholder = graph.nodes.find((n) => n.id === "EDW.queryinsights.fabric_sessions");
        expect(placeholder?.isPlaceholder).toBe(true);
        expect(placeholder?.itemName).toBe("EDW");
        expect(placeholder?.schemaName).toBe("queryinsights");
    });

    it("labels an unresolved placeholder's objectType with the extractor's resolved_type reason code", () => {
        const dependencies = dependenciesTable([
            [
                "Phoenix Hub", "ws", "EDW", "Warehouse", "Finance", "GL Transaction", "VIEW", "Transform_LH", "Contoso", "missing_table", "UNRESOLVED",
                "Transform_LH.Contoso.missing_table", "EDW.Finance.GL Transaction", false, false, "2026-07-25",
                "NOT_FOUND", "", "NOT_FOUND",
            ],
        ]);

        const graph = buildLineageGraph(objectsTable([]), dependencies, viewDefinitionsTable([]));

        const placeholder = graph.nodes.find((n) => n.id === "Transform_LH.Contoso.missing_table");
        expect(placeholder?.objectType).toBe("NOT_FOUND");
    });

    it("falls back to a generic UNKNOWN objectType when resolved_type is blank", () => {
        const dependencies = dependenciesTable([
            [
                "Phoenix Hub", "ws", "EDW", "Warehouse", "Finance", "GL Transaction", "VIEW", "Transform_LH", "Contoso", "missing_table", "UNRESOLVED",
                "Transform_LH.Contoso.missing_table", "EDW.Finance.GL Transaction", false, false, "2026-07-25",
                "", "", "",
            ],
        ]);

        const graph = buildLineageGraph(objectsTable([]), dependencies, viewDefinitionsTable([]));

        const placeholder = graph.nodes.find((n) => n.id === "Transform_LH.Contoso.missing_table");
        expect(placeholder?.objectType).toBe("UNKNOWN");
    });

    it("never lets a dependency's resolved_type override a real object already in the catalog", () => {
        const objects = objectsTable([
            ["Phoenix Hub", "ws", "Transform_LH", "Lakehouse", "Contoso", "GL Transaction", "USER_TABLE", "Transform_LH.Contoso.GL Transaction", "2026-01-01", "2026-01-01", "2026-07-25"],
        ]);
        const dependencies = dependenciesTable([
            [
                "Phoenix Hub", "ws", "EDW", "Warehouse", "Finance", "GL Transaction", "VIEW", "Transform_LH", "Contoso", "GL Transaction", "USER_TABLE",
                "Transform_LH.Contoso.GL Transaction", "EDW.Finance.GL Transaction", true, false, "2026-07-25",
                "NOT_FOUND", "", "NOT_FOUND",
            ],
        ]);

        const graph = buildLineageGraph(objects, dependencies, viewDefinitionsTable([]));

        const table = graph.nodes.find((n) => n.id === "Transform_LH.Contoso.GL Transaction");
        expect(table?.objectType).toBe("USER_TABLE");
        expect(table?.isPlaceholder).toBe(false);
    });

    it("joins on source_node_id, not source_id, when a table and its same-named view share a node_id", () => {
        // A table "entity" and a view "Entity" in the same schema would otherwise both
        // resolve to node_id "Transform_LH.Contoso.entity" (Power BI compares text
        // case-insensitively), so the extractor disambiguates with an #OBJECT_TYPE
        // suffix. source_id still holds the plain, as-written name; only
        // source_node_id carries the disambiguated id this edge actually resolved to.
        const objects = objectsTable([
            ["Phoenix Hub", "ws", "Transform_LH", "Lakehouse", "Contoso", "entity", "USER_TABLE", "Transform_LH.Contoso.entity#USER_TABLE", "2026-01-01", "2026-01-01", "2026-07-25"],
            ["Phoenix Hub", "ws", "Transform_LH", "Lakehouse", "Contoso", "Entity", "VIEW", "Transform_LH.Contoso.Entity#VIEW", "2026-01-01", "2026-01-01", "2026-07-25"],
        ]);
        const dependencies = dependenciesTable([
            [
                "Phoenix Hub", "ws", "Transform_LH", "Lakehouse", "Contoso", "Entity", "VIEW", "Transform_LH", "Contoso", "entity", "USER_TABLE",
                "Transform_LH.Contoso.entity", "Transform_LH.Contoso.Entity#VIEW", false, false, "2026-07-25",
                "USER_TABLE", "Transform_LH.Contoso.entity#USER_TABLE", "EXACT",
            ],
        ]);

        const graph = buildLineageGraph(objects, dependencies, viewDefinitionsTable([]));

        expect(graph.nodes).toHaveLength(2);
        expect(graph.edges).toHaveLength(1);
        expect(graph.edges[0]).toMatchObject({
            source: "Transform_LH.Contoso.entity#USER_TABLE",
            target: "Transform_LH.Contoso.Entity#VIEW",
        });

        const table = graph.nodes.find((n) => n.id === "Transform_LH.Contoso.entity#USER_TABLE");
        expect(table?.isPlaceholder).toBe(false);
        expect(table?.outDegree).toBe(1);

        const view = graph.nodes.find((n) => n.id === "Transform_LH.Contoso.Entity#VIEW");
        expect(view?.isPlaceholder).toBe(false);
        expect(view?.inDegree).toBe(1);
    });

    it("returns an empty graph for empty tables", () => {
        const graph = buildLineageGraph(objectsTable([]), dependenciesTable([]), viewDefinitionsTable([]));
        expect(graph.nodes).toHaveLength(0);
        expect(graph.edges).toHaveLength(0);
    });
});
