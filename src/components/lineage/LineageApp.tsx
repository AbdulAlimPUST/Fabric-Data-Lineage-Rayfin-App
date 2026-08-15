//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo, useState } from "react";
import { useAppTheme } from "@/hooks/use-theme";
import { useLineageGraph } from "@/hooks/use-lineage-graph";
import { filterLineageGraph } from "@/lib/lineage/filter-graph";
import { traceImpact } from "@/lib/lineage/impact-trace";
import { FilterToolbar, type ViewMode } from "./FilterToolbar";
import { DecompositionTree } from "./DecompositionTree";
import { LineageCanvas } from "./LineageCanvas";
import { DetailPanel, type NeighborLink } from "./DetailPanel";
import { DependencyTable } from "./DependencyTable";

function LoadingSkeleton() {
    return (
        <div className="flex h-full flex-1 items-center justify-center p-xxl">
            <div className="flex w-full max-w-2xl flex-col gap-m">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-md bg-muted" style={{ marginLeft: i * 48 }} />
                ))}
            </div>
        </div>
    );
}

export function LineageApp() {
    const { isDark, toggleTheme } = useAppTheme();
    const { graph, isLoading, error, refetch } = useLineageGraph();

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItemNames, setSelectedItemNames] = useState<Set<string> | null>(null);
    const [selectedObjectTypes, setSelectedObjectTypes] = useState<Set<string> | null>(null);
    const [crossItemOnly, setCrossItemOnly] = useState(false);
    const [hideSystemSchemas, setHideSystemSchemas] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>("canvas");
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const items = useMemo(() => {
        // Objects referenced only via a dependency edge (not in the Objects catalog)
        // become placeholder nodes with itemType "" — never let one of those overwrite
        // a real, already-known type for the same item name.
        const typeByName = new Map<string, string>();
        for (const node of graph?.nodes ?? []) {
            if (!typeByName.has(node.itemName)) typeByName.set(node.itemName, "");
            if (node.itemType) typeByName.set(node.itemName, node.itemType);
        }
        return Array.from(typeByName, ([name, type]) => ({ name, type: type || "Other" })).sort(
            (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
        );
    }, [graph]);
    const itemNames = useMemo(() => items.map((item) => item.name), [items]);
    const objectTypes = useMemo(
        () => Array.from(new Set(graph?.nodes.map((n) => n.objectType) ?? [])).sort(),
        [graph],
    );
    // Fabric auto-creates a scratch staging lakehouse/warehouse per Dataflow Gen2 —
    // ephemeral ETL plumbing, not business lineage — so they start unchecked.
    const defaultItemNames = useMemo(
        () => itemNames.filter((name) => !/^staging/i.test(name)),
        [itemNames],
    );

    const activeItemNames = selectedItemNames ?? new Set(defaultItemNames);
    const activeObjectTypes = selectedObjectTypes ?? new Set(objectTypes);

    const filteredGraph = useMemo(() => {
        if (!graph) return undefined;
        return filterLineageGraph(graph, {
            searchTerm,
            itemNames: activeItemNames,
            objectTypes: activeObjectTypes,
            crossItemOnly,
            hideSystemSchemas,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [graph, searchTerm, crossItemOnly, hideSystemSchemas, selectedItemNames, selectedObjectTypes]);

    // Every view in the warehouse (serving/final) layer gets its own decomposition
    // tree by default — no selection needed. "Warehouse" generalizes the concept
    // rather than hardcoding the "EDW" item name.
    const treeRootIds = useMemo(() => {
        if (!filteredGraph) return [];
        return filteredGraph.nodes
            .filter((n) => n.itemType === "Warehouse" && n.objectType === "VIEW")
            .sort((a, b) => a.schemaName.localeCompare(b.schemaName) || a.objectName.localeCompare(b.objectName))
            .map((n) => n.id);
    }, [filteredGraph]);

    const impact = useMemo(() => {
        if (!selectedNodeId || !filteredGraph) return null;
        if (!filteredGraph.nodes.some((n) => n.id === selectedNodeId)) return null;
        return traceImpact(selectedNodeId, filteredGraph.edges);
    }, [selectedNodeId, filteredGraph]);

    const selectedNode = useMemo(
        () => filteredGraph?.nodes.find((n) => n.id === selectedNodeId) ?? null,
        [filteredGraph, selectedNodeId],
    );

    const { upstream, downstream } = useMemo((): { upstream: NeighborLink[]; downstream: NeighborLink[] } => {
        if (!selectedNode || !filteredGraph) return { upstream: [], downstream: [] };
        const nodesById = new Map(filteredGraph.nodes.map((n) => [n.id, n]));
        const upstreamLinks: NeighborLink[] = [];
        const downstreamLinks: NeighborLink[] = [];
        for (const edge of filteredGraph.edges) {
            if (edge.target === selectedNode.id) {
                const node = nodesById.get(edge.source);
                if (node) upstreamLinks.push({ node, isCrossItem: edge.isCrossItem, isAmbiguous: edge.isAmbiguous });
            }
            if (edge.source === selectedNode.id) {
                const node = nodesById.get(edge.target);
                if (node) downstreamLinks.push({ node, isCrossItem: edge.isCrossItem, isAmbiguous: edge.isAmbiguous });
            }
        }
        return { upstream: upstreamLinks, downstream: downstreamLinks };
    }, [selectedNode, filteredGraph]);

    async function handleRefresh() {
        setIsRefreshing(true);
        try {
            await refetch();
        } finally {
            setIsRefreshing(false);
        }
    }

    function toggleSetMember(current: Set<string>, all: string[], value: string): Set<string> {
        const next = new Set(current);
        if (next.has(value)) {
            next.delete(value);
        } else {
            next.add(value);
        }
        return next.size === 0 ? new Set(all) : next;
    }

    function handleSelectItemGroup(names: string[], select: boolean) {
        const next = new Set(activeItemNames);
        for (const name of names) {
            if (select) next.add(name);
            else next.delete(name);
        }
        setSelectedItemNames(next.size === 0 ? new Set(defaultItemNames) : next);
    }

    function handleSelectObjectTypeGroup(types: string[], select: boolean) {
        const next = new Set(activeObjectTypes);
        for (const type of types) {
            if (select) next.add(type);
            else next.delete(type);
        }
        setSelectedObjectTypes(next.size === 0 ? new Set(objectTypes) : next);
    }

    function handleResetFilters() {
        setSearchTerm("");
        setSelectedItemNames(null);
        setSelectedObjectTypes(null);
        setCrossItemOnly(false);
    }

    return (
        <div className="flex h-full w-full flex-col bg-background">
            <FilterToolbar
                isDark={isDark}
                onToggleTheme={toggleTheme}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                items={items}
                selectedItemNames={activeItemNames}
                onToggleItemName={(name) => setSelectedItemNames(toggleSetMember(activeItemNames, itemNames, name))}
                onSelectItemGroup={handleSelectItemGroup}
                objectTypes={objectTypes}
                selectedObjectTypes={activeObjectTypes}
                onToggleObjectType={(type) => setSelectedObjectTypes(toggleSetMember(activeObjectTypes, objectTypes, type))}
                onSelectObjectTypeGroup={handleSelectObjectTypeGroup}
                crossItemOnly={crossItemOnly}
                onToggleCrossItemOnly={() => setCrossItemOnly((v) => !v)}
                hideSystemSchemas={hideSystemSchemas}
                onToggleHideSystemSchemas={() => setHideSystemSchemas((v) => !v)}
                viewMode={viewMode}
                onChangeViewMode={setViewMode}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                visibleNodeCount={filteredGraph?.nodes.length ?? 0}
                totalNodeCount={graph?.nodes.length ?? 0}
            />

            {error && (
                <div className="border-b border-destructive bg-[color-mix(in_srgb,var(--color-destructive)_10%,transparent)] px-l py-s text-200 text-destructive">
                    {error.message}
                </div>
            )}

            {isLoading && <LoadingSkeleton />}

            {!isLoading && graph && filteredGraph && (
                <>
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="flex min-h-0 flex-1">
                            <div className="h-full min-w-0 flex-1">
                                {filteredGraph.nodes.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-m p-xxl text-center">
                                        <p className="text-300 text-muted-foreground">
                                            No objects match the current filters.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={handleResetFilters}
                                            className="rounded-md border border-border bg-secondary px-m py-xs text-200 font-medium text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                                        >
                                            Reset filters
                                        </button>
                                    </div>
                                ) : viewMode === "graph" ? (
                                    treeRootIds.length === 0 ? (
                                        <div className="flex h-full flex-col items-center justify-center gap-m p-xxl text-center">
                                            <p className="text-300 text-muted-foreground">
                                                No warehouse views match the current filters. The Tree view needs at least one
                                                Warehouse item and the VIEW object type both enabled.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleResetFilters}
                                                className="rounded-md border border-border bg-secondary px-m py-xs text-200 font-medium text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                                            >
                                                Reset filters
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="h-full overflow-y-auto p-l">
                                            <div className="flex flex-col gap-xl">
                                                {treeRootIds.map((id) => (
                                                    <DecompositionTree
                                                        key={id}
                                                        rootId={id}
                                                        nodes={filteredGraph.nodes}
                                                        edges={filteredGraph.edges}
                                                        selectedNodeId={selectedNodeId}
                                                        onSelectNode={setSelectedNodeId}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )
                                ) : viewMode === "canvas" ? (
                                    <LineageCanvas
                                        nodes={filteredGraph.nodes}
                                        edges={filteredGraph.edges}
                                        selectedNodeId={selectedNodeId}
                                        onSelectNode={setSelectedNodeId}
                                        onClearSelection={() => setSelectedNodeId(null)}
                                    />
                                ) : (
                                    <DependencyTable edges={filteredGraph.edges} />
                                )}
                            </div>

                            {selectedNode && (
                                <div className="w-[380px] shrink-0">
                                    <DetailPanel
                                        node={selectedNode}
                                        upstream={upstream}
                                        downstream={downstream}
                                        impactUpstreamCount={impact?.upstream.size ?? 0}
                                        impactDownstreamCount={impact?.downstream.size ?? 0}
                                        onSelectNode={setSelectedNodeId}
                                        onClose={() => setSelectedNodeId(null)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
