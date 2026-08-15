//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Minus, Plus, Scan } from "lucide-react";
import { cn } from "@/lib/utils";
import { layoutLineageCanvas, layoutFocusedCanvas, CANVAS_NODE_WIDTH, CANVAS_NODE_HEIGHT, type CanvasLayout } from "@/lib/lineage/canvas-layout";
import { traceImpact } from "@/lib/lineage/impact-trace";
import { ITEM_TYPE_COLOR, objectTypeIcon, describeCard } from "@/lib/lineage/node-presentation";
import type { LineageEdge, LineageNode } from "@/lib/lineage/types";

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.2;
const MINIMAP_WIDTH = 190;
const MINIMAP_HEIGHT = 110;
const MINIMAP_PAD = 6;

interface LineageCanvasProps {
    nodes: LineageNode[];
    edges: LineageEdge[];
    selectedNodeId: string | null;
    onSelectNode: (nodeId: string) => void;
    onClearSelection: () => void;
}

/** Fabric-style free canvas: the whole filtered graph laid out left-to-right by dependency depth, pannable and zoomable. Selecting a node narrows the canvas to just its upstream/downstream path, re-laid-out tight, so the relevant chain is easy to read instead of scattered across the full graph. */
export function LineageCanvas({ nodes, edges, selectedNodeId, onSelectNode, onClearSelection }: LineageCanvasProps) {
    const impact = useMemo(() => (selectedNodeId ? traceImpact(selectedNodeId, edges) : null), [selectedNodeId, edges]);

    const onPath = useMemo(() => {
        if (!selectedNodeId || !impact) return null;
        const set = new Set(impact.upstream);
        impact.downstream.forEach((id) => set.add(id));
        set.add(selectedNodeId);
        return set;
    }, [selectedNodeId, impact]);

    // Focused mode: lay out only the selected node's upstream/downstream chain
    // (tight, close together) instead of the sparse full graph, so the relevant
    // path is easy to read. Clearing the selection restores the full graph.
    const visibleNodes = useMemo(() => (onPath ? nodes.filter((n) => onPath.has(n.id)) : nodes), [nodes, onPath]);
    const visibleEdges = useMemo(
        () => (onPath ? edges.filter((e) => onPath.has(e.source) && onPath.has(e.target)) : edges),
        [edges, onPath],
    );
    // Anchored on the selected node when focused (guarantees upstream stays left /
    // downstream stays right of it); otherwise the global left-to-right layout.
    const layout: CanvasLayout = useMemo(
        () =>
            selectedNodeId && onPath
                ? layoutFocusedCanvas(visibleNodes, visibleEdges, selectedNodeId)
                : layoutLineageCanvas(visibleNodes, visibleEdges),
        [visibleNodes, visibleEdges, selectedNodeId, onPath],
    );

    const focusedNode = onPath ? nodes.find((n) => n.id === selectedNodeId) : undefined;

    const wrapRef = useRef<HTMLDivElement>(null);
    const worldRef = useRef<HTMLDivElement>(null);
    const zoomReadoutRef = useRef<HTMLSpanElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const transform = useRef({ x: 0, y: 0, scale: 1 });
    const drag = useRef<{
        active: boolean;
        moved: boolean;
        startX: number;
        startY: number;
        startTx: number;
        startTy: number;
        pointerId: number;
        target: HTMLElement | null;
    }>({ active: false, moved: false, startX: 0, startY: 0, startTx: 0, startTy: 0, pointerId: 0, target: null });

    const minimapScale = layout.width > 0 && layout.height > 0
        ? Math.min((MINIMAP_WIDTH - MINIMAP_PAD * 2) / layout.width, (MINIMAP_HEIGHT - MINIMAP_PAD * 2) / layout.height)
        : 0;
    const minimapOffsetX = MINIMAP_PAD + ((MINIMAP_WIDTH - MINIMAP_PAD * 2) - layout.width * minimapScale) / 2;
    const minimapOffsetY = MINIMAP_PAD + ((MINIMAP_HEIGHT - MINIMAP_PAD * 2) - layout.height * minimapScale) / 2;

    const updateMinimapViewport = useCallback(() => {
        const wrap = wrapRef.current;
        const viewport = viewportRef.current;
        if (!wrap || !viewport || minimapScale === 0) return;
        const rect = wrap.getBoundingClientRect();
        const t = transform.current;
        const visX = -t.x / t.scale;
        const visY = -t.y / t.scale;
        const visW = rect.width / t.scale;
        const visH = rect.height / t.scale;
        viewport.style.left = `${minimapOffsetX + visX * minimapScale}px`;
        viewport.style.top = `${minimapOffsetY + visY * minimapScale}px`;
        viewport.style.width = `${Math.max(4, visW * minimapScale)}px`;
        viewport.style.height = `${Math.max(4, visH * minimapScale)}px`;
    }, [minimapScale, minimapOffsetX, minimapOffsetY]);

    const applyTransform = useCallback(
        (animate: boolean) => {
            const world = worldRef.current;
            if (!world) return;
            world.style.transition = animate ? "transform 220ms cubic-bezier(.2,.7,.3,1)" : "none";
            world.style.transform = `translate(${transform.current.x}px, ${transform.current.y}px) scale(${transform.current.scale})`;
            if (zoomReadoutRef.current) zoomReadoutRef.current.textContent = `${Math.round(transform.current.scale * 100)}%`;
            updateMinimapViewport();
        },
        [updateMinimapViewport],
    );

    const fitView = useCallback(
        (animate: boolean) => {
            const wrap = wrapRef.current;
            if (!wrap || layout.width === 0 || layout.height === 0) return;
            const rect = wrap.getBoundingClientRect();
            // Deliberately no MIN_SCALE floor here: a tall/wide filtered graph must be
            // able to zoom out past the manual-zoom floor to actually fit on first paint.
            // MIN_SCALE still bounds how far the +/- controls and wheel can zoom out.
            const fit = Math.min(rect.width / layout.width, rect.height / layout.height) * 0.9;
            const scale = Math.min(fit, 1.4);
            transform.current.scale = scale;
            transform.current.x = (rect.width - layout.width * scale) / 2;
            transform.current.y = (rect.height - layout.height * scale) / 2;
            applyTransform(animate);
        },
        [layout, applyTransform],
    );

    useEffect(() => {
        fitView(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layout]);

    useEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;
        function handleWheel(e: WheelEvent) {
            e.preventDefault();
            const rect = wrap!.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const t = transform.current;
            const worldX = (mx - t.x) / t.scale;
            const worldY = (my - t.y) / t.scale;
            t.scale = Math.max(MIN_SCALE, Math.min(t.scale * (1 - e.deltaY * 0.0012), MAX_SCALE));
            t.x = mx - worldX * t.scale;
            t.y = my - worldY * t.scale;
            applyTransform(false);
        }
        wrap.addEventListener("wheel", handleWheel, { passive: false });
        return () => wrap.removeEventListener("wheel", handleWheel);
    }, [applyTransform]);

    function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
        // Deliberately no setPointerCapture here: capturing on every pointerdown (even a
        // plain click with no movement) redirects the eventual "click" event's target to
        // this wrapper instead of the node underneath it, so the node's onClick never
        // fires. Capture is deferred to handlePointerMove, once a real drag is detected.
        drag.current = {
            active: true,
            moved: false,
            startX: e.clientX,
            startY: e.clientY,
            startTx: transform.current.x,
            startTy: transform.current.y,
            pointerId: e.pointerId,
            target: e.currentTarget,
        };
    }
    function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
        if (!drag.current.active) return;
        const dx = e.clientX - drag.current.startX;
        const dy = e.clientY - drag.current.startY;
        if (!drag.current.moved && Math.abs(dx) + Math.abs(dy) > 4) {
            drag.current.moved = true;
            drag.current.target?.setPointerCapture(drag.current.pointerId);
        }
        if (!drag.current.moved) return;
        transform.current.x = drag.current.startTx + dx;
        transform.current.y = drag.current.startTy + dy;
        applyTransform(false);
    }
    function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
        if (drag.current.moved) drag.current.target?.releasePointerCapture(e.pointerId);
        drag.current.active = false;
    }

    function zoomBy(factor: number) {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const t = transform.current;
        const worldX = (cx - t.x) / t.scale;
        const worldY = (cy - t.y) / t.scale;
        t.scale = Math.max(MIN_SCALE, Math.min(t.scale * factor, MAX_SCALE));
        t.x = cx - worldX * t.scale;
        t.y = cy - worldY * t.scale;
        applyTransform(true);
    }

    function handleMinimapClick(e: React.MouseEvent<HTMLDivElement>) {
        const wrap = wrapRef.current;
        if (!wrap || minimapScale === 0) return;
        const mmRect = e.currentTarget.getBoundingClientRect();
        const mx = e.clientX - mmRect.left - minimapOffsetX;
        const my = e.clientY - mmRect.top - minimapOffsetY;
        const worldX = mx / minimapScale;
        const worldY = my / minimapScale;
        const rect = wrap.getBoundingClientRect();
        transform.current.x = rect.width / 2 - worldX * transform.current.scale;
        transform.current.y = rect.height / 2 - worldY * transform.current.scale;
        applyTransform(true);
    }

    function handleNodeActivate(id: string) {
        if (drag.current.moved) return;
        onSelectNode(id);
    }

    if (layout.boxes.length === 0) {
        return (
            <div className="flex h-full items-center justify-center p-xxl text-center text-300 text-muted-foreground">
                No objects to lay out for the current filters.
            </div>
        );
    }

    return (
        <div className="relative h-full w-full overflow-hidden bg-background">
            <div
                ref={wrapRef}
                className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
                style={{ backgroundImage: "radial-gradient(var(--color-border) 1.2px, transparent 1.2px)", backgroundSize: "24px 24px" }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <div ref={worldRef} className="absolute left-0 top-0 origin-top-left" style={{ width: layout.width, height: layout.height }}>
                    <svg width={layout.width} height={layout.height} className="pointer-events-none absolute left-0 top-0 overflow-visible">
                        {layout.edges.map((edge, index) => {
                            const x1 = edge.from.x + CANVAS_NODE_WIDTH;
                            const y1 = edge.from.y + CANVAS_NODE_HEIGHT / 2;
                            const x2 = edge.to.x;
                            const y2 = edge.to.y + CANVAS_NODE_HEIGHT / 2;
                            const mx = (x1 + x2) / 2;
                            // In focus mode every edge in `layout` already belongs to the
                            // selected node's path (visibleEdges filtered to it), so it's
                            // always drawn emphasized — no separate on-path check needed.
                            const stroke = onPath
                                ? "var(--color-primary)"
                                : edge.isCrossItem
                                  ? "var(--color-lineage-cross-item)"
                                  : "var(--color-lineage-connector)";
                            return (
                                <path
                                    key={`${edge.from.id}->${edge.to.id}#${index}`}
                                    d={`M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                                    fill="none"
                                    stroke={stroke}
                                    strokeWidth={onPath ? 2.4 : 1.5}
                                    strokeDasharray={edge.isAmbiguous ? "5 4" : undefined}
                                    style={{ transition: "stroke .15s ease, stroke-width .15s ease" }}
                                />
                            );
                        })}
                    </svg>

                    {layout.boxes.map((box) => {
                        const Icon = objectTypeIcon(box.node.objectType);
                        const isSelected = box.id === selectedNodeId;
                        const isUpstream = impact?.upstream.has(box.id) ?? false;
                        const isDownstream = impact?.downstream.has(box.id) ?? false;
                        const typeColor = ITEM_TYPE_COLOR[box.node.itemType] ?? "var(--color-lineage-placeholder)";
                        const directionColor = isUpstream
                            ? "var(--color-lineage-upstream)"
                            : isDownstream
                              ? "var(--color-lineage-downstream)"
                              : undefined;

                        return (
                            <div
                                key={box.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => handleNodeActivate(box.id)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        handleNodeActivate(box.id);
                                    }
                                }}
                                aria-label={describeCard(box.node)}
                                aria-pressed={isSelected}
                                className={cn(
                                    "absolute flex cursor-pointer flex-col gap-xs rounded-lg border bg-card p-s shadow-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ring",
                                    isSelected ? "border-primary ring-2 ring-ring" : "border-border",
                                )}
                                style={{
                                    left: box.x,
                                    top: box.y,
                                    width: CANVAS_NODE_WIDTH,
                                    borderLeftColor: directionColor,
                                    borderLeftWidth: directionColor ? 3 : undefined,
                                }}
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
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="absolute left-l top-l z-10 flex items-center gap-xxs rounded-md border border-border bg-card p-xxs shadow-sm">
                <button
                    type="button"
                    onClick={() => zoomBy(0.8)}
                    aria-label="Zoom out"
                    className="flex icon-size-700 items-center justify-center rounded text-card-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                >
                    <Minus className="icon-size-200" aria-hidden />
                </button>
                <span ref={zoomReadoutRef} className="w-10 text-center font-monospace text-200 text-muted-foreground">
                    100%
                </span>
                <button
                    type="button"
                    onClick={() => zoomBy(1.25)}
                    aria-label="Zoom in"
                    className="flex icon-size-700 items-center justify-center rounded text-card-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                >
                    <Plus className="icon-size-200" aria-hidden />
                </button>
                <span className="mx-xxs h-5 w-px bg-border" aria-hidden />
                <button
                    type="button"
                    onClick={() => fitView(true)}
                    aria-label="Fit to view"
                    className="flex icon-size-700 items-center justify-center rounded text-card-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                >
                    <Scan className="icon-size-200" aria-hidden />
                </button>
            </div>

            {onPath && focusedNode && impact && (
                <div className="absolute left-1/2 top-l z-10 flex -translate-x-1/2 items-center gap-s rounded-md border border-border bg-card px-m py-xs shadow-sm">
                    <span className="text-200 text-card-foreground">
                        Focused on <span className="font-semibold">{focusedNode.objectName}</span>
                        <span className="text-muted-foreground">
                            {" "}
                            &middot; {impact.upstream.size} upstream &middot; {impact.downstream.size} downstream
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={onClearSelection}
                        className="shrink-0 rounded-md border border-border bg-secondary px-s py-xxs text-200 font-medium text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    >
                        Show all
                    </button>
                </div>
            )}

            <div className="absolute bottom-l left-l z-10 flex flex-col gap-xs rounded-md border border-border bg-card px-s py-xs text-200 text-muted-foreground shadow-sm">
                {onPath ? (
                    <>
                        <div className="flex items-center gap-xs">
                            <span className="icon-size-100 shrink-0 rounded-full" style={{ backgroundColor: "var(--color-lineage-upstream)" }} aria-hidden />
                            Upstream (depends on)
                        </div>
                        <div className="flex items-center gap-xs">
                            <span className="icon-size-100 shrink-0 rounded-full" style={{ backgroundColor: "var(--color-lineage-downstream)" }} aria-hidden />
                            Downstream (impact if down)
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-center gap-xs">
                            <span className="icon-size-100 shrink-0 rounded-full" style={{ backgroundColor: "var(--color-lineage-lakehouse)" }} aria-hidden />
                            Lakehouse
                        </div>
                        <div className="flex items-center gap-xs">
                            <span className="icon-size-100 shrink-0 rounded-full" style={{ backgroundColor: "var(--color-lineage-warehouse)" }} aria-hidden />
                            Warehouse
                        </div>
                        <div className="flex items-center gap-xs">
                            <span className="h-0.5 w-3 shrink-0" style={{ backgroundColor: "var(--color-lineage-cross-item)" }} aria-hidden />
                            Cross-item edge
                        </div>
                    </>
                )}
            </div>

            <div
                role="button"
                tabIndex={0}
                aria-label="Minimap — click to jump to that area of the graph"
                onClick={handleMinimapClick}
                onKeyDown={(e) => e.preventDefault()}
                className="absolute bottom-l right-l z-10 cursor-pointer overflow-hidden rounded-md border border-border bg-card shadow-sm"
                style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}
            >
                {layout.boxes.map((box) => (
                    <div
                        key={box.id}
                        className="absolute rounded-[1px]"
                        style={{
                            left: minimapOffsetX + box.x * minimapScale,
                            top: minimapOffsetY + box.y * minimapScale,
                            width: Math.max(2, CANVAS_NODE_WIDTH * minimapScale),
                            height: Math.max(2, CANVAS_NODE_HEIGHT * minimapScale),
                            backgroundColor: box.id === selectedNodeId ? "var(--color-primary)" : "var(--color-lineage-placeholder)",
                            opacity: 0.8,
                        }}
                    />
                ))}
                <div ref={viewportRef} className="pointer-events-none absolute rounded-[2px] border-2 border-primary bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]" />
            </div>
        </div>
    );
}
