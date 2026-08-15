import { describe, expect, it } from "vitest";
import { layoutDecompositionTree, BOX_HEIGHT, MAX_VISIBLE_DEPENDENCIES_PER_LEVEL } from "./decomposition-layout";
import type { LineageEdge, LineageNode } from "./types";

function node(id: string): LineageNode {
    return {
        id,
        itemName: id.split(".")[0],
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

describe("layoutDecompositionTree", () => {
    it("returns null when the root id isn't in the node set", () => {
        expect(layoutDecompositionTree("missing", [node("A")], [], new Set())).toBeNull();
    });

    it("returns a single box for a root with no dependencies", () => {
        const layout = layoutDecompositionTree("A", [node("A")], [], new Set());
        expect(layout!.boxes).toHaveLength(1);
        expect(layout!.boxes[0]).toMatchObject({ id: "A", depth: 0, hasDependencies: false });
        expect(layout!.edges).toHaveLength(0);
    });

    it("marks hasDependencies true but stays collapsed (one box) until expanded", () => {
        // A depends on B, but A is not in the expanded set.
        const layout = layoutDecompositionTree("A", [node("A"), node("B")], [edge("b->a", "B", "A")], new Set());
        expect(layout!.boxes).toHaveLength(1);
        expect(layout!.boxes[0].hasDependencies).toBe(true);
    });

    it("reveals direct dependencies one column to the right when expanded", () => {
        const layout = layoutDecompositionTree(
            "A",
            [node("A"), node("B"), node("C")],
            [edge("b->a", "B", "A"), edge("c->a", "C", "A")],
            new Set(["A"]),
        );
        expect(layout!.boxes).toHaveLength(3);
        const byId = new Map(layout!.boxes.map((b) => [b.id, b]));
        expect(byId.get("B")!.depth).toBe(1);
        expect(byId.get("C")!.depth).toBe(1);
        expect(byId.get("B")!.x).toBeGreaterThan(byId.get("A")!.x);
        expect(layout!.edges).toHaveLength(2);
    });

    it("centers a parent on the vertical span of its expanded children", () => {
        const layout = layoutDecompositionTree(
            "A",
            [node("A"), node("B"), node("C")],
            [edge("b->a", "B", "A"), edge("c->a", "C", "A")],
            new Set(["A"]),
        );
        const byId = new Map(layout!.boxes.map((b) => [b.id, b]));
        const b = byId.get("B")!.y, c = byId.get("C")!.y, a = byId.get("A")!.y;
        expect(a).toBeCloseTo((Math.min(b, c) + Math.max(b, c)) / 2);
    });

    it("expands multiple levels independently when nested nodes are in the expanded set", () => {
        // A <- B <- C (B depends on C, A depends on B)
        const layout = layoutDecompositionTree(
            "A",
            [node("A"), node("B"), node("C")],
            [edge("b->a", "B", "A"), edge("c->b", "C", "B")],
            new Set(["A", "B"]),
        );
        const byId = new Map(layout!.boxes.map((b) => [b.id, b]));
        expect(byId.get("C")!.depth).toBe(2);
    });

    it("gives a shared dependency its own box per branch (diamond), not a single merged node", () => {
        // A depends on B and C; both B and C depend on Raw.
        const layout = layoutDecompositionTree(
            "A",
            [node("A"), node("B"), node("C"), node("Raw")],
            [edge("b->a", "B", "A"), edge("c->a", "C", "A"), edge("raw->b", "Raw", "B"), edge("raw->c", "Raw", "C")],
            new Set(["A", "B", "C"]),
        );
        const rawBoxes = layout!.boxes.filter((b) => b.id === "Raw");
        expect(rawBoxes).toHaveLength(2);
    });

    it("cuts a dependency cycle instead of recursing forever", () => {
        const layout = layoutDecompositionTree(
            "A",
            [node("A"), node("B")],
            [edge("b->a", "B", "A"), edge("a->b", "A", "B")],
            new Set(["A", "B"]),
        );
        expect(layout).not.toBeNull();
        expect(layout!.boxes.length).toBeGreaterThan(0);
        expect(layout!.height).toBeGreaterThanOrEqual(BOX_HEIGHT);
    });

    it("keeps a box's path stable when an unrelated sibling branch expands or collapses", () => {
        // Root depends on B and C independently; B has its own dependency D.
        const nodes = [node("Root"), node("B"), node("C"), node("D")];
        const edges = [edge("b->root", "B", "Root"), edge("c->root", "C", "Root"), edge("d->b", "D", "B")];

        const collapsed = layoutDecompositionTree("Root", nodes, edges, new Set(["Root"]));
        const cPathBefore = collapsed!.boxes.find((b) => b.id === "C")!.path;

        // Expanding B (revealing D) shifts C's y (recentering), but C's identity/path must not change.
        const expanded = layoutDecompositionTree("Root", nodes, edges, new Set(["Root", "B"]));
        const cBoxAfter = expanded!.boxes.find((b) => b.id === "C")!;

        expect(cBoxAfter.path).toBe(cPathBefore);
    });

    it("caps a level at MAX_VISIBLE_DEPENDENCIES_PER_LEVEL and reports the remainder as hiddenDependencyCount", () => {
        const total = MAX_VISIBLE_DEPENDENCIES_PER_LEVEL + 5;
        const deps = Array.from({ length: total }, (_, i) => node(`Dep${String(i).padStart(2, "0")}`));
        const edges = deps.map((d) => edge(`${d.id}->root`, d.id, "Root"));

        const layout = layoutDecompositionTree("Root", [node("Root"), ...deps], edges, new Set(["Root"]));

        const rootBox = layout!.boxes.find((b) => b.id === "Root")!;
        expect(rootBox.hiddenDependencyCount).toBe(5);
        // Root box itself + the 20 visible dependency boxes.
        expect(layout!.boxes).toHaveLength(MAX_VISIBLE_DEPENDENCIES_PER_LEVEL + 1);
        expect(layout!.edges).toHaveLength(MAX_VISIBLE_DEPENDENCIES_PER_LEVEL);
    });

    it("reports hiddenDependencyCount of 0 for levels at or under the cap", () => {
        const layout = layoutDecompositionTree(
            "A",
            [node("A"), node("B")],
            [edge("b->a", "B", "A")],
            new Set(["A"]),
        );
        expect(layout!.boxes.find((b) => b.id === "A")!.hiddenDependencyCount).toBe(0);
    });

    it("gives each occurrence of a shared dependency (diamond) a distinct path", () => {
        const layout = layoutDecompositionTree(
            "A",
            [node("A"), node("B"), node("C"), node("Raw")],
            [edge("b->a", "B", "A"), edge("c->a", "C", "A"), edge("raw->b", "Raw", "B"), edge("raw->c", "Raw", "C")],
            new Set(["A", "B", "C"]),
        );
        const rawPaths = layout!.boxes.filter((b) => b.id === "Raw").map((b) => b.path);
        expect(new Set(rawPaths).size).toBe(2);
    });
});
