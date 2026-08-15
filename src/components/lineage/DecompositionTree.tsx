//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { layoutDecompositionTree, BOX_WIDTH, BOX_HEIGHT, MAX_VISIBLE_DEPENDENCIES_PER_LEVEL } from "@/lib/lineage/decomposition-layout";
import { ITEM_TYPE_COLOR, objectTypeIcon, plural, describeCard } from "@/lib/lineage/node-presentation";
import type { LineageEdge, LineageNode } from "@/lib/lineage/types";

const PAD = 28;

interface DecompositionTreeProps {
    rootId: string;
    nodes: LineageNode[];
    edges: LineageEdge[];
    selectedNodeId: string | null;
    onSelectNode: (nodeId: string) => void;
}

/** Inner component keyed by rootId in the parent, so `expanded` resets automatically when the root changes. */
function DecompositionTreeInner({ rootId, nodes, edges, selectedNodeId, onSelectNode }: DecompositionTreeProps) {
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootId]));

    const layout = useMemo(
        () => layoutDecompositionTree(rootId, nodes, edges, expanded),
        [rootId, nodes, edges, expanded],
    );

    if (!layout) {
        return (
            <div className="flex h-full items-center justify-center p-xxl text-center text-300 text-muted-foreground">
                Selected root is no longer in the filtered view.
            </div>
        );
    }

    function toggle(id: string) {
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const width = layout.width + PAD * 2;
    const height = layout.height + PAD * 2;

    return (
        <div
            className="max-h-[480px] w-full overflow-auto rounded-lg bg-background"
            style={{ backgroundImage: "radial-gradient(var(--color-border) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        >
            <div className="relative" style={{ width, height }}>
                <svg width={width} height={height} className="pointer-events-none absolute left-0 top-0 overflow-visible">
                    {layout.edges.map((edge, index) => {
                        const x1 = edge.from.x + BOX_WIDTH + PAD;
                        const y1 = edge.from.y + BOX_HEIGHT / 2 + PAD;
                        const x2 = edge.to.x + PAD;
                        const y2 = edge.to.y + BOX_HEIGHT / 2 + PAD;
                        const mx = (x1 + x2) / 2;
                        const stroke = edge.isCrossItem ? "var(--color-lineage-cross-item)" : "var(--color-lineage-connector)";
                        return (
                            <path
                                key={`${edge.from.id}->${edge.to.id}#${index}`}
                                d={`M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                                fill="none"
                                stroke={stroke}
                                strokeWidth={1.5}
                                strokeDasharray={edge.isAmbiguous ? "5 4" : undefined}
                            />
                        );
                    })}
                </svg>

                {layout.boxes.map((box) => {
                    const Icon = objectTypeIcon(box.node.objectType);
                    const isRoot = box.id === rootId;
                    const isSelected = box.id === selectedNodeId;
                    const isOpen = expanded.has(box.id);
                    const typeColor = ITEM_TYPE_COLOR[box.node.itemType] ?? "var(--color-lineage-placeholder)";

                    return (
                        <div
                            key={box.path}
                            role="button"
                            tabIndex={0}
                            onClick={() => onSelectNode(box.id)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onSelectNode(box.id);
                                }
                            }}
                            aria-label={describeCard(box.node)}
                            aria-pressed={isSelected}
                            className={cn(
                                "absolute flex cursor-pointer flex-col gap-xs rounded-lg border bg-card p-s shadow-sm animate-dt-node-in focus-visible:outline-2 focus-visible:outline-ring",
                                isRoot ? "border-primary" : "border-border",
                                isSelected && "ring-2 ring-ring",
                            )}
                            style={{ left: box.x + PAD, top: box.y + PAD, width: BOX_WIDTH }}
                        >
                            <div className="flex min-w-0 items-center gap-xs">
                                <Icon className="icon-size-200 shrink-0" style={{ color: typeColor }} aria-hidden />
                                <span className="truncate text-300 font-semibold text-card-foreground" title={box.node.objectName}>
                                    {box.node.objectName}
                                </span>
                            </div>
                            <p className="truncate font-monospace text-200 text-muted-foreground" title={`${box.node.itemName}.${box.node.schemaName}`}>
                                {box.node.itemName}.{box.node.schemaName}
                            </p>
                            <div className="flex items-center gap-xs">
                                <span className="icon-size-100 shrink-0 rounded-full" style={{ backgroundColor: typeColor }} aria-hidden />
                                <span className="text-200 uppercase tracking-wide text-muted-foreground">{box.node.itemType || box.node.objectType}</span>
                                {box.hiddenDependencyCount > 0 && (
                                    <span
                                        className="ml-auto shrink-0 text-200 font-semibold"
                                        style={{ color: "var(--color-lineage-unresolved)" }}
                                        title={`${box.hiddenDependencyCount} more upstream source${plural(box.hiddenDependencyCount)} not shown (limit ${MAX_VISIBLE_DEPENDENCIES_PER_LEVEL} per level)`}
                                    >
                                        +{box.hiddenDependencyCount}
                                    </span>
                                )}
                            </div>

                            {box.hasDependencies ? (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggle(box.id);
                                    }}
                                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${box.node.objectName}`}
                                    aria-expanded={isOpen}
                                    className={cn(
                                        "absolute right-0 top-1/2 flex icon-size-500 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border-2 border-card shadow-sm focus-visible:outline-2 focus-visible:outline-ring",
                                        isOpen ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground",
                                    )}
                                >
                                    {isOpen ? <Minus className="icon-size-200" aria-hidden /> : <Plus className="icon-size-200" aria-hidden />}
                                </button>
                            ) : (
                                <span
                                    className="absolute right-0 top-1/2 icon-size-100 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-card"
                                    style={{ backgroundColor: "var(--color-lineage-placeholder)" }}
                                    title="No further upstream"
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** Power BI-style decomposition tree: pick a root, expand a box's "+" to branch its upstream dependencies out as connected boxes. */
export function DecompositionTree(props: DecompositionTreeProps) {
    return <DecompositionTreeInner key={props.rootId} {...props} />;
}
