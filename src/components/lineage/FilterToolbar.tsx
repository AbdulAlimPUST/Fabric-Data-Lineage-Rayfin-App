//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { GitBranch, Network, RefreshCw, Search, Table as TableIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ItemFilterDropdown, type FabricItem } from "./ItemFilterDropdown";
import { MoreFiltersDropdown } from "./MoreFiltersDropdown";
import { ObjectTypeFilterDropdown } from "./ObjectTypeFilterDropdown";

export type ViewMode = "graph" | "canvas" | "table";

interface FilterToolbarProps {
    isDark: boolean;
    onToggleTheme: () => void;
    searchTerm: string;
    onSearchTermChange: (value: string) => void;
    items: FabricItem[];
    selectedItemNames: Set<string>;
    onToggleItemName: (name: string) => void;
    onSelectItemGroup: (names: string[], select: boolean) => void;
    objectTypes: string[];
    selectedObjectTypes: Set<string>;
    onToggleObjectType: (type: string) => void;
    onSelectObjectTypeGroup: (types: string[], select: boolean) => void;
    crossItemOnly: boolean;
    onToggleCrossItemOnly: () => void;
    hideSystemSchemas: boolean;
    onToggleHideSystemSchemas: () => void;
    viewMode: ViewMode;
    onChangeViewMode: (mode: ViewMode) => void;
    onRefresh: () => void;
    isRefreshing: boolean;
    visibleNodeCount: number;
    totalNodeCount: number;
}

/** Single-line control surface: title, search, item/type/other filters, view switch, refresh, and theme toggle. */
export function FilterToolbar({
    isDark,
    onToggleTheme,
    searchTerm,
    onSearchTermChange,
    items,
    selectedItemNames,
    onToggleItemName,
    onSelectItemGroup,
    objectTypes,
    selectedObjectTypes,
    onToggleObjectType,
    onSelectObjectTypeGroup,
    crossItemOnly,
    onToggleCrossItemOnly,
    hideSystemSchemas,
    onToggleHideSystemSchemas,
    viewMode,
    onChangeViewMode,
    onRefresh,
    isRefreshing,
    visibleNodeCount,
    totalNodeCount,
}: FilterToolbarProps) {
    return (
        <div className="flex flex-nowrap items-center gap-m overflow-x-auto border-b border-border bg-card px-l py-m">
            <GitBranch className="icon-size-400 shrink-0 text-primary" aria-hidden />
            <h1 className="shrink-0 whitespace-nowrap font-heading text-500 font-semibold text-card-foreground">Data Lineage</h1>

            <div className="relative shrink-0">
                <Search className="icon-size-200 pointer-events-none absolute left-s top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <input
                    type="search"
                    value={searchTerm}
                    onChange={(e) => onSearchTermChange(e.target.value)}
                    placeholder="Search objects…"
                    aria-label="Search lineage objects"
                    className="w-56 rounded-md border border-input bg-background py-xs pl-[calc(var(--spacing-s)*2+var(--icon-size-200))] pr-s text-300 text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                />
            </div>

            <ItemFilterDropdown
                items={items}
                selected={selectedItemNames}
                onToggle={onToggleItemName}
                onSelectGroup={onSelectItemGroup}
            />

            <ObjectTypeFilterDropdown
                objectTypes={objectTypes}
                selected={selectedObjectTypes}
                onToggle={onToggleObjectType}
                onSelectGroup={onSelectObjectTypeGroup}
            />

            <MoreFiltersDropdown
                crossItemOnly={crossItemOnly}
                onToggleCrossItemOnly={onToggleCrossItemOnly}
                hideSystemSchemas={hideSystemSchemas}
                onToggleHideSystemSchemas={onToggleHideSystemSchemas}
            />

            <span className="shrink-0 whitespace-nowrap text-200 text-muted-foreground">
                {visibleNodeCount} / {totalNodeCount} objects
            </span>

            <div className="ml-auto flex shrink-0 items-center gap-s">
                <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="View mode">
                    <button
                        type="button"
                        aria-pressed={viewMode === "graph"}
                        onClick={() => onChangeViewMode("graph")}
                        className={cn(
                            "flex items-center gap-xs px-s py-xs text-200 font-medium focus-visible:outline-2 focus-visible:outline-ring",
                            viewMode === "graph" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent",
                        )}
                    >
                        <GitBranch className="icon-size-200" aria-hidden /> Tree
                    </button>
                    <button
                        type="button"
                        aria-pressed={viewMode === "canvas"}
                        onClick={() => onChangeViewMode("canvas")}
                        className={cn(
                            "flex items-center gap-xs border-l border-border px-s py-xs text-200 font-medium focus-visible:outline-2 focus-visible:outline-ring",
                            viewMode === "canvas" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent",
                        )}
                    >
                        <Network className="icon-size-200" aria-hidden /> Canvas
                    </button>
                    <button
                        type="button"
                        aria-pressed={viewMode === "table"}
                        onClick={() => onChangeViewMode("table")}
                        className={cn(
                            "flex items-center gap-xs border-l border-border px-s py-xs text-200 font-medium focus-visible:outline-2 focus-visible:outline-ring",
                            viewMode === "table" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent",
                        )}
                    >
                        <TableIcon className="icon-size-200" aria-hidden /> Table
                    </button>
                </div>

                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-xs whitespace-nowrap rounded-md border border-border bg-secondary px-s py-xs text-200 font-medium text-secondary-foreground hover:bg-accent disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring"
                >
                    <RefreshCw className={cn("icon-size-200", isRefreshing && "animate-spin")} aria-hidden />
                    Refresh
                </button>

                <button
                    type="button"
                    onClick={onToggleTheme}
                    className="whitespace-nowrap rounded-md border border-border px-s py-xs text-200 font-medium text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                >
                    {isDark ? "Light mode" : "Dark mode"}
                </button>
            </div>
        </div>
    );
}
