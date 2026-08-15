import type { LineageEdge, LineageNode } from "./types";

export const BOX_WIDTH = 194;
export const BOX_HEIGHT = 78;
const COL_GAP = 96;
const ROW_GAP = 22;
const COL_WIDTH = BOX_WIDTH + COL_GAP;
const ROW_HEIGHT = BOX_HEIGHT + ROW_GAP;

/**
 * ui-ux-pro-max decomposition-tree guidance: cap visible nodes per level at 20
 * for readability and lazy-load the rest. We don't lazy-load on scroll (the
 * whole point is showing every warehouse view's tree at once), so instead we
 * show the top 20 (alphabetically, for a predictable/stable cut) and surface
 * the remainder as a count rather than silently dropping them.
 */
export const MAX_VISIBLE_DEPENDENCIES_PER_LEVEL = 20;

export interface DecompositionBox {
    id: string;
    x: number;
    y: number;
    depth: number;
    node: LineageNode;
    /** True when this node has upstream dependencies it could still be expanded to reveal. */
    hasDependencies: boolean;
    /**
     * Stable structural identity (root-to-here id chain) for use as a React `key`.
     * Unlike `y`, this never changes when a sibling elsewhere in the tree expands or
     * collapses and shifts this box's vertical position — so already-rendered boxes
     * don't unmount/remount (and re-play their pop-in animation) for an unrelated change.
     */
    path: string;
    /** Count of additional upstream dependencies beyond MAX_VISIBLE_DEPENDENCIES_PER_LEVEL, not rendered as boxes. */
    hiddenDependencyCount: number;
}

export interface DecompositionEdge {
    from: DecompositionBox;
    to: DecompositionBox;
    isCrossItem: boolean;
    isAmbiguous: boolean;
}

export interface DecompositionLayout {
    boxes: DecompositionBox[];
    edges: DecompositionEdge[];
    width: number;
    height: number;
}

/**
 * Lays out a Power BI-style decomposition tree rooted at `rootId`: only nodes
 * in `expanded` reveal their upstream dependencies (via `target -> source`,
 * matching the app's edge direction) as boxes one column to the right, joined
 * by a connector. Leaf rows are stacked top-to-bottom in visitation order;
 * a parent centers vertically on the span of its visible children. The same
 * underlying object can legitimately appear in more than one branch (e.g. a
 * shared raw table) — each occurrence gets its own box, as in Power BI.
 */
export function layoutDecompositionTree(
    rootId: string,
    nodes: LineageNode[],
    edges: LineageEdge[],
    expanded: ReadonlySet<string>,
): DecompositionLayout | null {
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    if (!nodesById.has(rootId)) return null;

    const dependenciesByTarget = new Map<string, LineageEdge[]>();
    for (const edge of edges) {
        if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) continue;
        (dependenciesByTarget.get(edge.target) ?? dependenciesByTarget.set(edge.target, []).get(edge.target)!).push(edge);
    }

    const boxes: DecompositionBox[] = [];
    const decompositionEdges: DecompositionEdge[] = [];
    let nextSlot = 0;

    function place(id: string, depth: number, ancestors: ReadonlySet<string>, path: string): DecompositionBox {
        const node = nodesById.get(id)!;
        const allDeps = dependenciesByTarget.get(id) ?? [];
        // A dependency edge back to an ancestor would recurse forever — treat it as a leaf here.
        const deps = expanded.has(id) && !ancestors.has(id) ? allDeps.filter((e) => !ancestors.has(e.source)) : [];

        let visibleDeps = deps;
        let hiddenDependencyCount = 0;
        if (deps.length > MAX_VISIBLE_DEPENDENCIES_PER_LEVEL) {
            const sorted = [...deps].sort((a, b) =>
                nodesById.get(a.source)!.objectName.localeCompare(nodesById.get(b.source)!.objectName),
            );
            visibleDeps = sorted.slice(0, MAX_VISIBLE_DEPENDENCIES_PER_LEVEL);
            hiddenDependencyCount = deps.length - MAX_VISIBLE_DEPENDENCIES_PER_LEVEL;
        }

        if (deps.length === 0) {
            const box: DecompositionBox = {
                id,
                x: depth * COL_WIDTH,
                y: nextSlot * ROW_HEIGHT,
                depth,
                node,
                hasDependencies: allDeps.length > 0,
                path,
                hiddenDependencyCount: 0,
            };
            nextSlot += 1;
            boxes.push(box);
            return box;
        }

        const childAncestors = new Set(ancestors);
        childAncestors.add(id);
        const childBoxes = visibleDeps.map((edge) => place(edge.source, depth + 1, childAncestors, `${path}>${edge.source}`));
        const ys = childBoxes.map((b) => b.y);
        const box: DecompositionBox = {
            id,
            x: depth * COL_WIDTH,
            y: (Math.min(...ys) + Math.max(...ys)) / 2,
            depth,
            node,
            hasDependencies: true,
            path,
            hiddenDependencyCount,
        };
        boxes.push(box);
        visibleDeps.forEach((edge, i) => {
            decompositionEdges.push({ from: box, to: childBoxes[i], isCrossItem: edge.isCrossItem, isAmbiguous: edge.isAmbiguous });
        });
        return box;
    }

    place(rootId, 0, new Set(), rootId);

    const maxDepth = Math.max(...boxes.map((b) => b.depth));
    const width = (maxDepth + 1) * COL_WIDTH - COL_GAP;
    const height = Math.max(nextSlot * ROW_HEIGHT - ROW_GAP, BOX_HEIGHT);

    return { boxes, edges: decompositionEdges, width, height };
}
