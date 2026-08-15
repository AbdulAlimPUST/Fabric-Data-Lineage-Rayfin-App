//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

function CheckboxSquare({ checked }: { checked: boolean }) {
    return (
        <span
            className={cn(
                "flex icon-size-300 shrink-0 items-center justify-center rounded-sm border",
                checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
            )}
        >
            {checked && <Check className="icon-size-200" aria-hidden />}
        </span>
    );
}

interface MoreFiltersDropdownProps {
    crossItemOnly: boolean;
    onToggleCrossItemOnly: () => void;
    hideSystemSchemas: boolean;
    onToggleHideSystemSchemas: () => void;
}

/** Dropdown for the two boolean graph filters: cross-item boundary crossing only, and hiding Fabric's system schemas. */
export function MoreFiltersDropdown({
    crossItemOnly,
    onToggleCrossItemOnly,
    hideSystemSchemas,
    onToggleHideSystemSchemas,
}: MoreFiltersDropdownProps) {
    const activeCount = Number(crossItemOnly) + Number(hideSystemSchemas);

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
                <button
                    type="button"
                    className="flex items-center gap-xs rounded-md border border-border bg-secondary px-s py-xs text-200 font-medium text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring data-[state=open]:bg-accent"
                >
                    Filters
                    <span className="rounded-full bg-primary px-xs text-200 font-semibold text-primary-foreground">
                        {activeCount}/2
                    </span>
                    <ChevronDown className="icon-size-100" aria-hidden />
                </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
                <DropdownMenu.Content
                    align="start"
                    sideOffset={6}
                    className="z-50 w-72 overflow-y-auto rounded-md border border-border bg-popover p-xs shadow-lg"
                >
                    <DropdownMenu.CheckboxItem
                        checked={crossItemOnly}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={onToggleCrossItemOnly}
                        className={cn(
                            "flex cursor-pointer items-center gap-s rounded-md px-s py-xs text-200 text-popover-foreground outline-none",
                            "data-[highlighted]:bg-accent",
                        )}
                    >
                        <CheckboxSquare checked={crossItemOnly} />
                        <span
                            className="icon-size-100 shrink-0 rounded-full"
                            style={{ backgroundColor: "var(--color-lineage-cross-item)" }}
                            aria-hidden
                        />
                        <span className="truncate">Cross-item only</span>
                    </DropdownMenu.CheckboxItem>

                    <DropdownMenu.CheckboxItem
                        checked={hideSystemSchemas}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={onToggleHideSystemSchemas}
                        title="Hide Fabric's built-in queryinsights monitoring schema"
                        className={cn(
                            "flex cursor-pointer items-center gap-s rounded-md px-s py-xs text-200 text-popover-foreground outline-none",
                            "data-[highlighted]:bg-accent",
                        )}
                    >
                        <CheckboxSquare checked={hideSystemSchemas} />
                        <EyeOff className="icon-size-200 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate">Hide system schemas</span>
                    </DropdownMenu.CheckboxItem>
                </DropdownMenu.Content>
            </DropdownMenu.Portal>
        </DropdownMenu.Root>
    );
}
