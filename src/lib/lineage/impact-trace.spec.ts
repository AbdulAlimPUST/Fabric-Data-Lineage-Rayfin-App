import { describe, expect, it } from "vitest";
import { traceImpact } from "./impact-trace";
import type { LineageEdge } from "./types";

function edge(id: string, source: string, target: string): LineageEdge {
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
    };
}

describe("traceImpact", () => {
    it("separates upstream (depends-on) from downstream (impact-if-down)", () => {
        // Raw -> Silver -> Gold -> Report
        const edges = [
            edge("raw->silver", "Raw", "Silver"),
            edge("silver->gold", "Silver", "Gold"),
            edge("gold->report", "Gold", "Report"),
        ];

        const { upstream, downstream } = traceImpact("Gold", edges);

        expect(upstream).toEqual(new Set(["Silver", "Raw"]));
        expect(downstream).toEqual(new Set(["Report"]));
    });

    it("excludes the focus node itself from both sets in an acyclic graph", () => {
        const edges = [edge("a->b", "A", "B"), edge("c->a", "C", "A")];
        const { upstream, downstream } = traceImpact("A", edges);
        expect(upstream.has("A")).toBe(false);
        expect(downstream.has("A")).toBe(false);
        expect(upstream).toEqual(new Set(["C"]));
        expect(downstream).toEqual(new Set(["B"]));
    });

    it("returns empty sets for a node with no edges", () => {
        const { upstream, downstream } = traceImpact("Isolated", []);
        expect(upstream.size).toBe(0);
        expect(downstream.size).toBe(0);
    });

    it("handles a cycle without infinite looping (the focus is legitimately reachable from itself)", () => {
        const edges = [edge("a->b", "A", "B"), edge("b->a", "B", "A")];
        const { downstream } = traceImpact("A", edges);
        expect(downstream).toEqual(new Set(["B", "A"]));
    });
});
