//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo, useState } from "react";
import { format as formatSql } from "sql-formatter";
import { AlignLeft, ArrowLeft, ArrowRight, Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { displayNodeId, sqlDialectForItemType } from "@/lib/lineage/node-presentation";
import type { LineageNode } from "@/lib/lineage/types";

export interface NeighborLink {
    node: LineageNode;
    isCrossItem: boolean;
    isAmbiguous: boolean;
}

interface DetailPanelProps {
    node: LineageNode;
    upstream: NeighborLink[];
    downstream: NeighborLink[];
    /** Total transitively-reachable upstream/downstream node counts (not just direct neighbors), for the impact stat row. */
    impactUpstreamCount: number;
    impactDownstreamCount: number;
    onSelectNode: (nodeId: string) => void;
    onClose: () => void;
}

function formatDate(date: Date | null): string {
    if (!date) return "—";
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function NeighborList({ title, icon: Icon, links, onSelectNode }: {
    title: string;
    icon: typeof ArrowLeft;
    links: NeighborLink[];
    onSelectNode: (nodeId: string) => void;
}) {
    return (
        <div>
            <h3 className="flex items-center gap-xs text-200 font-semibold uppercase tracking-wide text-muted-foreground">
                <Icon className="icon-size-200" aria-hidden />
                {title} ({links.length})
            </h3>
            {links.length === 0 ? (
                <p className="mt-xs text-200 text-muted-foreground">None</p>
            ) : (
                <ul className="mt-xs flex flex-col gap-xs">
                    {links.map(({ node, isCrossItem, isAmbiguous }) => (
                        <li key={node.id}>
                            <button
                                type="button"
                                onClick={() => onSelectNode(node.id)}
                                className="flex w-full items-center justify-between gap-s rounded-md border border-border bg-secondary px-s py-xs text-left text-200 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                            >
                                <span className="min-w-0">
                                    <span className="block truncate font-medium text-secondary-foreground">{node.objectName}</span>
                                    <span className="block truncate font-monospace text-200 text-muted-foreground">
                                        {node.itemName}.{node.schemaName}
                                    </span>
                                </span>
                                <span className="flex shrink-0 gap-xxs">
                                    {isCrossItem && (
                                        <span className="rounded-full bg-[color-mix(in_srgb,var(--color-lineage-cross-item)_18%,transparent)] px-xs py-xxs text-200 font-medium" style={{ color: "var(--color-lineage-cross-item)" }}>
                                            cross-item
                                        </span>
                                    )}
                                    {isAmbiguous && (
                                        <span className="rounded-full px-xs py-xxs text-200 font-medium" style={{ color: "var(--color-lineage-unresolved)", backgroundColor: "color-mix(in srgb, var(--color-lineage-unresolved) 18%, transparent)" }}>
                                            unresolved
                                        </span>
                                    )}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** Side panel showing metadata, direct lineage neighbors, and (for views) the SQL definition of the selected node. */
export function DetailPanel({
    node,
    upstream,
    downstream,
    impactUpstreamCount,
    impactDownstreamCount,
    onSelectNode,
    onClose,
}: DetailPanelProps) {
    const [copied, setCopied] = useState(false);
    const [isFormatted, setIsFormatted] = useState(false);

    const rawViewDefinition = node.viewDefinition?.trim() ?? null;

    const formattedViewDefinition = useMemo(() => {
        if (!rawViewDefinition) return null;
        try {
            return formatSql(rawViewDefinition, { language: sqlDialectForItemType(node.itemType) });
        } catch {
            // Not all view definitions are parseable (e.g. vendor-specific syntax) — fall back to the raw text.
            return rawViewDefinition;
        }
    }, [rawViewDefinition, node.itemType]);

    const displayedViewDefinition = isFormatted ? formattedViewDefinition : rawViewDefinition;

    async function handleCopy() {
        if (!displayedViewDefinition) return;
        await navigator.clipboard.writeText(displayedViewDefinition);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    return (
        <aside className="flex h-full w-full flex-col gap-l overflow-y-auto border-l border-border bg-card p-l">
            <div className="flex items-start justify-between gap-s">
                <div className="min-w-0">
                    <p className="truncate font-heading text-500 font-semibold text-card-foreground">{node.objectName}</p>
                    <p className="mt-xxs truncate font-monospace text-200 text-muted-foreground">{displayNodeId(node.id)}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close details panel"
                    className="shrink-0 rounded-md p-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                    <X className="icon-size-300" aria-hidden />
                </button>
            </div>

            <div className="flex gap-xl">
                <div>
                    <p className="text-600 font-semibold" style={{ color: "var(--color-lineage-upstream)" }}>
                        {impactUpstreamCount}
                    </p>
                    <p className="text-200 uppercase tracking-wide text-muted-foreground">Depends on</p>
                </div>
                <div>
                    <p className="text-600 font-semibold" style={{ color: "var(--color-lineage-downstream)" }}>
                        {impactDownstreamCount}
                    </p>
                    <p className="text-200 uppercase tracking-wide text-muted-foreground">Impact if down</p>
                </div>
            </div>

            {node.isPlaceholder && (
                <p className="rounded-md border border-dashed border-border bg-secondary px-s py-xs text-200 text-muted-foreground">
                    Not present in the object catalog — inferred only from a dependency reference.
                </p>
            )}

            <dl className="grid grid-cols-2 gap-x-s gap-y-m text-200">
                <div>
                    <dt className="text-muted-foreground">Item</dt>
                    <dd className="font-medium text-card-foreground">{node.itemName || "—"}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Item Type</dt>
                    <dd className="font-medium text-card-foreground">{node.itemType || "—"}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Schema</dt>
                    <dd className="font-medium text-card-foreground">{node.schemaName || "—"}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Object Type</dt>
                    <dd className="font-medium text-card-foreground">{node.objectType}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd className="font-medium text-card-foreground">{formatDate(node.createdAt)}</dd>
                </div>
                <div>
                    <dt className="text-muted-foreground">Modified</dt>
                    <dd className="font-medium text-card-foreground">{formatDate(node.modifiedAt)}</dd>
                </div>
            </dl>

            <NeighborList title="Upstream sources" icon={ArrowLeft} links={upstream} onSelectNode={onSelectNode} />
            <NeighborList title="Downstream consumers" icon={ArrowRight} links={downstream} onSelectNode={onSelectNode} />

            {displayedViewDefinition && (
                <div>
                    <div className="flex items-center justify-between">
                        <h3 className="text-200 font-semibold uppercase tracking-wide text-muted-foreground">View Definition</h3>
                        <div className="flex items-center gap-xxs">
                            <button
                                type="button"
                                onClick={() => setIsFormatted((v) => !v)}
                                aria-pressed={isFormatted}
                                className={cn(
                                    "flex items-center gap-xxs rounded-md px-s py-xxs text-200 font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                                    isFormatted ? "text-[color:var(--color-lineage-lakehouse)]" : "text-muted-foreground",
                                )}
                            >
                                <AlignLeft className="icon-size-200" aria-hidden />
                                {isFormatted ? "Formatted" : "Format"}
                            </button>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className={cn(
                                    "flex items-center gap-xxs rounded-md px-s py-xxs text-200 font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
                                    copied ? "text-[color:var(--color-lineage-lakehouse)]" : "text-muted-foreground",
                                )}
                            >
                                {copied ? <Check className="icon-size-200" aria-hidden /> : <Copy className="icon-size-200" aria-hidden />}
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>
                    </div>
                    <pre className="mt-xs max-h-[320px] overflow-auto rounded-md border border-border bg-muted p-s font-monospace text-200 leading-300 text-foreground">
                        {displayedViewDefinition}
                    </pre>
                </div>
            )}
        </aside>
    );
}
