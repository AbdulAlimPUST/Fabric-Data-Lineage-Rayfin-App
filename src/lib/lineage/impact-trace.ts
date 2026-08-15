import type { LineageEdge } from "./types";

export interface ImpactTrace {
    /** Every node transitively depended on by the focus node (excludes the focus itself). */
    upstream: Set<string>;
    /** Every node that would be impacted if the focus node went down (excludes the focus itself). */
    downstream: Set<string>;
}

function reachable(startId: string, byNode: Map<string, string[]>): Set<string> {
    const seen = new Set<string>();
    const stack = [startId];
    while (stack.length > 0) {
        const current = stack.pop()!;
        for (const next of byNode.get(current) ?? []) {
            if (!seen.has(next)) {
                seen.add(next);
                stack.push(next);
            }
        }
    }
    return seen;
}

/**
 * Computes the two directions of impact for the radial view, kept separate
 * (unlike a combined lineage trace) so the canvas can color them independently:
 * upstream ("depends on") walks `target -> source`, downstream ("impact if
 * down") walks `source -> target`. Neither set includes the focus node itself.
 */
export function traceImpact(focusId: string, edges: LineageEdge[]): ImpactTrace {
    const outgoing = new Map<string, string[]>();
    const incoming = new Map<string, string[]>();
    for (const edge of edges) {
        (outgoing.get(edge.source) ?? outgoing.set(edge.source, []).get(edge.source)!).push(edge.target);
        (incoming.get(edge.target) ?? incoming.set(edge.target, []).get(edge.target)!).push(edge.source);
    }

    return {
        upstream: reachable(focusId, incoming),
        downstream: reachable(focusId, outgoing),
    };
}
