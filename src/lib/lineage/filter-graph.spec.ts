import { describe, expect, it } from "vitest";
import { filterLineageGraph } from "./filter-graph";
import type { LineageEdge, LineageGraph, LineageNode } from "./types";

function node(overrides: Partial<LineageNode> & Pick<LineageNode, "id" | "itemName" | "objectType" | "objectName">): LineageNode {
    return {
        schemaName: "dbo",
        itemType: "Lakehouse",
        createdAt: null,
        modifiedAt: null,
        viewDefinition: null,
        isPlaceholder: false,
        inDegree: 0,
        outDegree: 0,
        ...overrides,
    };
}

function edge(overrides: Partial<LineageEdge> & Pick<LineageEdge, "id" | "source" | "target">): LineageEdge {
    return {
        itemName: "EDW",
        referencingObject: "",
        referencedObject: "",
        referencedType: "VIEW",
        isCrossItem: false,
        isAmbiguous: false,
        ...overrides,
    };
}

const graph: LineageGraph = {
    nodes: [
        node({ id: "Raw.dbo.Customer", itemName: "Raw_LH", objectType: "USER_TABLE", objectName: "Customer" }),
        node({ id: "Transform.dbo.Customer", itemName: "Transform_LH", objectType: "VIEW", objectName: "Customer" }),
        node({ id: "EDW.dbo.Customer", itemName: "EDW", objectType: "VIEW", objectName: "Customer" }),
        node({ id: "EDW.dbo.Orphan", itemName: "EDW", objectType: "VIEW", objectName: "Orphan" }),
    ],
    edges: [
        edge({ id: "e1", source: "Raw.dbo.Customer", target: "Transform.dbo.Customer", isCrossItem: true }),
        edge({ id: "e2", source: "Transform.dbo.Customer", target: "EDW.dbo.Customer", isCrossItem: true }),
    ],
};

const allItemNames = new Set(["Raw_LH", "Transform_LH", "EDW"]);
const allObjectTypes = new Set(["USER_TABLE", "VIEW"]);

describe("filterLineageGraph", () => {
    it("returns the full graph when no filters narrow anything", () => {
        const result = filterLineageGraph(graph, {
            searchTerm: "",
            itemNames: allItemNames,
            objectTypes: allObjectTypes,
            crossItemOnly: false,
            hideSystemSchemas: false,
        });
        expect(result.nodes).toHaveLength(4);
        expect(result.edges).toHaveLength(2);
    });

    it("filters nodes by search term and drops edges touching filtered-out nodes", () => {
        const result = filterLineageGraph(graph, {
            searchTerm: "orphan",
            itemNames: allItemNames,
            objectTypes: allObjectTypes,
            crossItemOnly: false,
            hideSystemSchemas: false,
        });
        expect(result.nodes.map((n) => n.id)).toEqual(["EDW.dbo.Orphan"]);
        expect(result.edges).toHaveLength(0);
    });

    it("filters by item name", () => {
        const result = filterLineageGraph(graph, {
            searchTerm: "",
            itemNames: new Set(["Raw_LH"]),
            objectTypes: allObjectTypes,
            crossItemOnly: false,
            hideSystemSchemas: false,
        });
        expect(result.nodes.map((n) => n.id)).toEqual(["Raw.dbo.Customer"]);
    });

    it("crossItemOnly drops same-item edges and any node left with no edges", () => {
        const result = filterLineageGraph(graph, {
            searchTerm: "",
            itemNames: allItemNames,
            objectTypes: allObjectTypes,
            crossItemOnly: true,
            hideSystemSchemas: false,
        });
        // Orphan has no edges at all, so it's dropped once cross-item-only is active.
        expect(result.nodes.map((n) => n.id).sort()).toEqual(
            ["EDW.dbo.Customer", "Raw.dbo.Customer", "Transform.dbo.Customer"].sort(),
        );
        expect(result.edges).toHaveLength(2);
    });

    it("hideSystemSchemas drops nodes in Fabric's built-in queryinsights schema", () => {
        const graphWithSystemSchema: LineageGraph = {
            nodes: [
                ...graph.nodes,
                node({ id: "EDW.queryinsights.fabric_sessions", itemName: "EDW", objectType: "VIEW", objectName: "fabric_sessions", schemaName: "queryinsights" }),
            ],
            edges: graph.edges,
        };

        const result = filterLineageGraph(graphWithSystemSchema, {
            searchTerm: "",
            itemNames: allItemNames,
            objectTypes: allObjectTypes,
            crossItemOnly: false,
            hideSystemSchemas: true,
        });

        expect(result.nodes.some((n) => n.schemaName === "queryinsights")).toBe(false);
        expect(result.nodes).toHaveLength(4);
    });
});
