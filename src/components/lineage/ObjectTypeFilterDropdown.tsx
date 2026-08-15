//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { objectTypeIcon } from "@/lib/lineage/node-presentation";

interface ObjectTypeFilterDropdownProps {
    objectTypes: string[];
    selected: Set<string>;
    onToggle: (type: string) => void;
    onSelectGroup: (types: string[], select: boolean) => void;
}

/** Multi-select dropdown for object types (VIEW, USER_TABLE, and any unresolved-reason codes). */
export function ObjectTypeFilterDropdown({ objectTypes, selected, onToggle, onSelectGroup }: ObjectTypeFilterDropdownProps) {
    const allSelected = objectTypes.every((type) => selected.has(type));

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    type="button"
                    className="flex items-center gap-xs rounded-md border border-border bg-secondary px-s py-xs text-200 font-medium text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-accent"
                >
                    Object Type
                    <span className="rounded-full bg-primary px-xs text-200 font-semibold text-primary-foreground">
                        {selected.size}/{objectTypes.length}
                    </span>
                    <ChevronDown className="icon-size-100" aria-hidden />
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 max-h-[70vh] w-64 overflow-y-auto rounded-md border border-border bg-popover p-xs shadow-lg"
                >
                    <div className="flex items-center justify-end px-s py-xxs">
                        <button
                            type="button"
                            className="text-200 font-medium text-primary hover:underline"
                            onClick={() => onSelectGroup(objectTypes, !allSelected)}
                        >
                            {allSelected ? "Clear" : "Select all"}
                        </button>
                    </div>
                    {objectTypes.map((type) => {
                        const isChecked = selected.has(type);
                        const Icon = objectTypeIcon(type);
                        return (
                            <DropdownMenu.CheckboxItem
                                key={type}
                                checked={isChecked}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={() => onToggle(type)}
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
                                <Icon className="icon-size-200 shrink-0 text-muted-foreground" aria-hidden />
                                <span className="truncate">{type}</span>
                            </DropdownMenu.CheckboxItem>
                        );
                    })}
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
