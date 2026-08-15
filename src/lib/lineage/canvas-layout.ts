import type { LineageEdge, LineageNode } from "./types";

export const CANVAS_NODE_WIDTH = 220;
export const CANVAS_NODE_HEIGHT = 74;
const COL_GAP = 110;
const ROW_GAP = 20;
const COL_WIDTH = CANVAS_NODE_WIDTH + COL_GAP;
const ROW_HEIGHT = CANVAS_NODE_HEIGHT + ROW_GAP;

export interface CanvasBox {
    id: string;
    x: number;
    y: number;
    depth: number;
    node: LineageNode;
}

export interface CanvasEdge {
    from: CanvasBox;
    to: CanvasBox;
    isCrossItem: boolean;
    isAmbiguous: boolean;
}

export interface CanvasLayout {
    boxes: CanvasBox[];
    edges: CanvasEdge[];
    width: number;
    height: number;
}

/** Places already-computed (possibly negative) depths into columns/rows and builds the layout. */
function layoutFromDepths(nodes: LineageNode[], validEdges: LineageEdge[], depthById: Map<string, number>): CanvasLayout {
    if (nodes.length === 0) return { boxes: [], edges: [], width: 0, height: 0 };

    const minDepth = Math.min(...depthById.values());
    const byColumn = new Map<number, LineageNode[]>();
    for (const node of nodes) {
        const col = depthById.get(node.id)! - minDepth;
        (byColumn.get(col) ?? byColumn.set(col, []).get(col)!).push(node);
    }

    const boxesById = new Map<string, CanvasBox>();
    const boxes: CanvasBox[] = [];
    let maxRows = 0;
    for (const [col, group] of byColumn) {
        group.sort(
            (a, b) =>
                a.itemName.localeCompare(b.itemName) ||
                a.schemaName.localeCompare(b.schemaName) ||
                a.objectName.localeCompare(b.objectName),
        );
        group.forEach((node, row) => {
            const box: CanvasBox = { id: node.id, x: col * COL_WIDTH, y: row * ROW_HEIGHT, depth: col, node };
            boxes.push(box);
            boxesById.set(node.id, box);
        });
        maxRows = Math.max(maxRows, group.length);
    }

    const canvasEdges: CanvasEdge[] = validEdges.map((edge) => ({
        from: boxesById.get(edge.source)!,
        to: boxesById.get(edge.target)!,
        isCrossItem: edge.isCrossItem,
        isAmbiguous: edge.isAmbiguous,
    }));

    const maxCol = Math.max(...byColumn.keys());
    const width = (maxCol + 1) * COL_WIDTH - COL_GAP;
    const height = maxRows * ROW_HEIGHT - ROW_GAP;

    return { boxes, edges: canvasEdges, width, height };
}

/**
 * Lays out the *whole* filtered graph at once (no expand/collapse): every node
 * gets a column by dependency depth (0 = no upstream dependency) and a row
 * within that column, so the canvas reads left-to-right like Fabric's own
 * lineage graph. Depth is assigned via Kahn's algorithm (longest path from a
 * root, in topological order) rather than iterative relaxation — a legitimate
 * dependency cycle has no topological order at all, so its nodes never reach
 * in-degree 0 and are clamped to one column past the deepest resolved node
 * instead of growing without bound.
 */
export function layoutLineageCanvas(nodes: LineageNode[], edges: LineageEdge[]): CanvasLayout {
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const validEdges = edges.filter((e) => nodesById.has(e.source) && nodesById.has(e.target));

    const inDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    const outBySource = new Map<string, string[]>();
    for (const edge of validEdges) {
        inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
        (outBySource.get(edge.source) ?? outBySource.set(edge.source, []).get(edge.source)!).push(edge.target);
    }

    const depth = new Map<string, number>();
    const remaining = new Map(inDegree);
    const queue: string[] = [];
    for (const n of nodes) {
        if (inDegree.get(n.id) === 0) {
            depth.set(n.id, 0);
            queue.push(n.id);
        }
    }
    for (let i = 0; i < queue.length; i++) {
        const id = queue[i];
        const d = depth.get(id)!;
        for (const target of outBySource.get(id) ?? []) {
            const candidate = d + 1;
            if (!depth.has(target) || candidate > depth.get(target)!) depth.set(target, candidate);
            const left = (remaining.get(target) ?? 0) - 1;
            remaining.set(target, left);
            if (left === 0) queue.push(target);
        }
    }
    // Any node left without a depth is part of (or depends only on) a cycle —
    // park it one column past the deepest node resolved so far.
    let maxResolvedDepth = 0;
    for (const d of depth.values()) if (d > maxResolvedDepth) maxResolvedDepth = d;
    for (const n of nodes) {
        if (!depth.has(n.id)) depth.set(n.id, maxResolvedDepth + 1);
    }

    return layoutFromDepths(nodes, validEdges, depth);
}

/**
 * Lays out a node set *anchored on `focusId`* (used for the focus/isolate view):
 * depth is measured as hop-distance from the focus node itself — upstream hops
 * count down (negative, placed left), downstream hops count up (positive,
 * placed right) — rather than `layoutLineageCanvas`'s global longest-path-from-a-root
 * measure. That global measure only guarantees upstream-left/downstream-right
 * relative to *some* root, not relative to the selected node, so reusing it here
 * could put a true upstream node to the right of the very thing it feeds. BFS
 * distance from the focus node is well-defined even if the data has a cycle
 * (a visited-set bounds each walk), so it can't be thrown off the way a global
 * topological sort can.
 */
export function layoutFocusedCanvas(nodes: LineageNode[], edges: LineageEdge[], focusId: string): CanvasLayout {
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    if (!nodesById.has(focusId)) return layoutLineageCanvas(nodes, edges);
    const validEdges = edges.filter((e) => nodesById.has(e.source) && nodesById.has(e.target));

    const sourcesByTarget = new Map<string, string[]>();
    const targetsBySource = new Map<string, string[]>();
    for (const edge of validEdges) {
        (sourcesByTarget.get(edge.target) ?? sourcesByTarget.set(edge.target, []).get(edge.target)!).push(edge.source);
        (targetsBySource.get(edge.source) ?? targetsBySource.set(edge.source, []).get(edge.source)!).push(edge.target);
    }

    const depth = new Map<string, number>([[focusId, 0]]);

    function walk(startDepth: number, step: number, neighborsOf: Map<string, string[]>) {
        const visited = new Set([focusId]);
        let frontier = [focusId];
        let d = startDepth;
        while (frontier.length > 0) {
            const next: string[] = [];
            for (const id of frontier) {
                for (const neighbor of neighborsOf.get(id) ?? []) {
                    if (visited.has(neighbor)) continue;
                    visited.add(neighbor);
                    depth.set(neighbor, d);
                    next.push(neighbor);
                }
            }
            frontier = next;
            d += step;
        }
    }
    walk(-1, -1, sourcesByTarget);
    walk(1, 1, targetsBySource);

    // Nodes outside the focus node's up/downstream closure (shouldn't normally
    // occur — callers filter to that closure already) sit alongside the focus.
    for (const n of nodes) {
        if (!depth.has(n.id)) depth.set(n.id, 0);
    }

    return layoutFromDepths(nodes, validEdges, depth);
}
