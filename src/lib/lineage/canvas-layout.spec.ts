import { describe, expect, it } from "vitest";
import { layoutLineageCanvas, layoutFocusedCanvas, CANVAS_NODE_WIDTH } from "./canvas-layout";
import type { LineageEdge, LineageNode } from "./types";

function node(id: string, itemName = "EDW"): LineageNode {
    return {
        id,
        itemName,
        itemType: "Lakehouse",
        schemaName: "dbo",
        objectName: id,
        objectType: "USER_TABLE",
        createdAt: null,
        modifiedAt: null,
        viewDefinition: null,
        isPlaceholder: false,
        inDegree: 0,
        outDegree: 0,
    };
}

function edge(id: string, source: string, target: string, overrides: Partial<LineageEdge> = {}): LineageEdge {
    return {
        id,
        source,
        target,
        itemName: "EDW",
        referencingObject: target,
        referencedObject: source,
        referencedType: "VIEW",
        isCrossItem: false,
        isAmbiguous: false,
        ...overrides,
    };
}

describe("layoutLineageCanvas", () => {
    it("returns an empty layout for no nodes", () => {
        const layout = layoutLineageCanvas([], []);
        expect(layout.boxes).toHaveLength(0);
        expect(layout.width).toBe(0);
        expect(layout.height).toBe(0);
    });

    it("places a node with no dependencies at depth 0", () => {
        const layout = layoutLineageCanvas([node("A")], []);
        expect(layout.boxes[0]).toMatchObject({ id: "A", depth: 0, x: 0, y: 0 });
    });

    it("places every node in the graph at once, without needing expansion", () => {
        const layout = layoutLineageCanvas(
            [node("A"), node("B"), node("C")],
            [edge("a->b", "A", "B"), edge("b->c", "B", "C")],
        );
        expect(layout.boxes).toHaveLength(3);
    });

    it("assigns depth by longest dependency chain, one column right of its upstream", () => {
        const layout = layoutLineageCanvas(
            [node("A"), node("B"), node("C")],
            [edge("a->b", "A", "B"), edge("b->c", "B", "C")],
        );
        const byId = new Map(layout.boxes.map((b) => [b.id, b]));
        expect(byId.get("A")!.depth).toBe(0);
        expect(byId.get("B")!.depth).toBe(1);
        expect(byId.get("C")!.depth).toBe(2);
        expect(byId.get("B")!.x).toBeGreaterThan(byId.get("A")!.x);
    });

    it("takes the longest path when a node has dependencies of differing depth (diamond)", () => {
        // A -> B -> D, A -> D directly. D must sit past B, not tied to the direct A->D edge.
        const layout = layoutLineageCanvas(
            [node("A"), node("B"), node("D")],
            [edge("a->b", "A", "B"), edge("b->d", "B", "D"), edge("a->d", "A", "D")],
        );
        const byId = new Map(layout.boxes.map((b) => [b.id, b]));
        expect(byId.get("D")!.depth).toBe(2);
    });

    it("stacks nodes sharing a depth into distinct rows without overlapping y", () => {
        const layout = layoutLineageCanvas([node("A"), node("B"), node("C")], []);
        const ys = layout.boxes.map((b) => b.y);
        expect(new Set(ys).size).toBe(3);
    });

    it("does not hang or crash on a dependency cycle", () => {
        const layout = layoutLineageCanvas(
            [node("A"), node("B")],
            [edge("a->b", "A", "B"), edge("b->a", "B", "A")],
        );
        expect(layout.boxes).toHaveLength(2);
    });

    it("drops edges that reference a node outside the filtered set", () => {
        const layout = layoutLineageCanvas([node("A"), node("B")], [edge("a->b", "A", "B"), edge("b->missing", "B", "Missing")]);
        expect(layout.edges).toHaveLength(1);
    });

    it("sizes width to the deepest column and height to the tallest column", () => {
        const layout = layoutLineageCanvas(
            [node("A"), node("B"), node("C"), node("D")],
            [edge("a->b", "A", "B")],
        );
        // A, B share... no: A depth 0, B depth 1; C and D also depth 0 (no deps) alongside A.
        const byId = new Map(layout.boxes.map((b) => [b.id, b]));
        expect(byId.get("A")!.depth).toBe(0);
        expect(layout.width).toBeGreaterThanOrEqual(CANVAS_NODE_WIDTH);
        expect(layout.height).toBeGreaterThan(0);
    });
});

describe("layoutFocusedCanvas", () => {
    it("places the focus node at column 0", () => {
        const layout = layoutFocusedCanvas([node("A")], [], "A");
        expect(layout.boxes[0]).toMatchObject({ id: "A", depth: 0 });
    });

    it("puts every upstream node left of focus and every downstream node right of it, even when focus has both", () => {
        // Reproduces the reported bug shape: two upstream tables feeding a view (focus),
        // which itself feeds a downstream warehouse view.
        const layout = layoutFocusedCanvas(
            [node("Contoso"), node("WideWorldImporters"), node("PhoenixDataView"), node("EDWPhoenixData")],
            [
                edge("contoso->view", "Contoso", "PhoenixDataView"),
                edge("wwi->view", "WideWorldImporters", "PhoenixDataView"),
                edge("view->edw", "PhoenixDataView", "EDWPhoenixData"),
            ],
            "PhoenixDataView",
        );
        const byId = new Map(layout.boxes.map((b) => [b.id, b]));
        const focusX = byId.get("PhoenixDataView")!.x;
        expect(byId.get("Contoso")!.x).toBeLessThan(focusX);
        expect(byId.get("WideWorldImporters")!.x).toBeLessThan(focusX);
        expect(byId.get("EDWPhoenixData")!.x).toBeGreaterThan(focusX);
    });

    it("uses hop-distance from focus, not a global topological measure, so an upstream node is never pushed past focus", () => {
        // B is two hops upstream of focus via C, but ALSO has a direct (shorter) edge
        // to something unrelated — a shape where a global longest-path measure could
        // disagree with "distance from focus" about ordering.
        const layout = layoutFocusedCanvas(
            [node("B"), node("C"), node("Focus")],
            [edge("b->c", "B", "C"), edge("c->focus", "C", "Focus")],
            "Focus",
        );
        const byId = new Map(layout.boxes.map((b) => [b.id, b]));
        expect(byId.get("B")!.x).toBeLessThan(byId.get("C")!.x);
        expect(byId.get("C")!.x).toBeLessThan(byId.get("Focus")!.x);
    });

    it("still terminates and keeps focus centered when the node set contains a cycle", () => {
        const layout = layoutFocusedCanvas(
            [node("Focus"), node("A"), node("B")],
            [edge("focus->a", "Focus", "A"), edge("a->b", "A", "B"), edge("b->a", "B", "A")],
            "Focus",
        );
        expect(layout.boxes).toHaveLength(3);
        const byId = new Map(layout.boxes.map((b) => [b.id, b]));
        expect(byId.get("A")!.x).toBeGreaterThan(byId.get("Focus")!.x);
    });

    it("gives a diamond-shared upstream ancestor a single consistent (left-of-focus) column", () => {
        // Raw feeds both B and C, which both feed Focus.
        const layout = layoutFocusedCanvas(
            [node("Raw"), node("B"), node("C"), node("Focus")],
            [
                edge("raw->b", "Raw", "B"),
                edge("raw->c", "Raw", "C"),
                edge("b->focus", "B", "Focus"),
                edge("c->focus", "C", "Focus"),
            ],
            "Focus",
        );
        const byId = new Map(layout.boxes.map((b) => [b.id, b]));
        expect(byId.get("Raw")!.x).toBeLessThan(byId.get("B")!.x);
        expect(byId.get("Raw")!.x).toBeLessThan(byId.get("C")!.x);
        expect(byId.get("B")!.x).toBeLessThan(byId.get("Focus")!.x);
        expect(byId.get("C")!.x).toBeLessThan(byId.get("Focus")!.x);
    });
});
