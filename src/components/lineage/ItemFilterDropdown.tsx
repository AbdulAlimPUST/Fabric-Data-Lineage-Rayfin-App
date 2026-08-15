//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FabricItem {
    name: string;
    /** e.g. "Lakehouse" or "Warehouse". */
    type: string;
}

const TYPE_COLOR: Record<string, string> = {
    Lakehouse: "var(--color-lineage-lakehouse)",
    Warehouse: "var(--color-lineage-warehouse)",
};

interface ItemFilterDropdownProps {
    items: FabricItem[];
    selected: Set<string>;
    onToggle: (name: string) => void;
    onSelectGroup: (names: string[], select: boolean) => void;
}

/** Multi-select dropdown for Fabric items, grouped by item type (Lakehouse / Warehouse / ...). */
export function ItemFilterDropdown({ items, selected, onToggle, onSelectGroup }: ItemFilterDropdownProps) {
    const groups = new Map<string, FabricItem[]>();
    for (const item of items) {
        const group = groups.get(item.type) ?? [];
        group.push(item);
        groups.set(item.type, group);
    }

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    type="button"
                    className="flex items-center gap-xs rounded-md border border-border bg-secondary px-s py-xs text-200 font-medium text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-accent"
                >
                    Items
                    <span className="rounded-full bg-primary px-xs text-200 font-semibold text-primary-foreground">
                        {selected.size}/{items.length}
                    </span>
                    <ChevronDown className="icon-size-100" aria-hidden />
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 max-h-[70vh] w-72 overflow-y-auto rounded-md border border-border bg-popover p-xs shadow-lg"
                >
                    {Array.from(groups.entries()).map(([type, groupItems], index) => {
                        const groupNames = groupItems.map((i) => i.name);
                        const allSelected = groupNames.every((name) => selected.has(name));
                        return (
                            <div key={type}>
                                {index > 0 && <DropdownMenu.Separator className="my-xs h-px bg-border" />}
                                <div className="flex items-center justify-between px-s py-xxs">
                                    <DropdownMenu.Label className="flex items-center gap-xs text-200 font-semibold uppercase tracking-wide text-muted-foreground">
                                        <span
                                            className="icon-size-100 shrink-0 rounded-full"
                                            style={{ backgroundColor: TYPE_COLOR[type] ?? "var(--color-lineage-placeholder)" }}
                                            aria-hidden
                                        />
                                        {type}
                                    </DropdownMenu.Label>
                                    <button
                                        type="button"
                                        className="text-200 font-medium text-primary hover:underline"
                                        onClick={() => onSelectGroup(groupNames, !allSelected)}
                                    >
                                        {allSelected ? "Clear" : "Select all"}
                                    </button>
                                </div>
                                {groupItems.map((item) => {
                                    const isChecked = selected.has(item.name);
                                    return (
                                        <DropdownMenu.CheckboxItem
                                            key={item.name}
                                            checked={isChecked}
                                            onSelect={(e) => e.preventDefault()}
                                            onCheckedChange={() => onToggle(item.name)}
                                            className={cn(
                                                "flex cursor-pointer items-center gap-s rounded-md px-s py-xs text-200 text-popover-foreground outline-none",
                                                "data-[highlighted]:bg-accent",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "flex icon-size-300 shrink-0 items-center justify-center rounded-sm border",
                                                    isChecked ? "border-primary bg-primary text-primary-foreground" : "border-input",
                                                )}
                                            >
                                                {isChecked && <Check className="icon-size-200" aria-hidden />}
                                            </span>
                                            <span className="truncate">{item.name}</span>
                                        </DropdownMenu.CheckboxItem>
                                    );
                                })}
                            </div>
                        );
                    })}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
