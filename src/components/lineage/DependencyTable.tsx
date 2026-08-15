//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { useMemo } from "react";
import { DataGrid } from "@microsoft/fabric-datagrid";
import { useCssTheme } from "@microsoft/fabric-visuals";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { displayNodeId } from "@/lib/lineage/node-presentation";
import type { LineageEdge } from "@/lib/lineage/types";

interface DependencyTableProps {
    edges: LineageEdge[];
}

/** Accessible tabular fallback for the graph view — one row per dependency edge. */
export function DependencyTable({ edges }: DependencyTableProps) {
    const theme = useCssTheme();

    const dataTable: DataTable = useMemo(
        () => ({
            columns: [
                { name: "Item", displayName: "Item" },
                { name: "Source", displayName: "Upstream (Source)" },
                { name: "Target", displayName: "Downstream (Target)" },
                { name: "CrossItem", displayName: "Cross-Item" },
                { name: "Ambiguous", displayName: "Unresolved" },
            ],
            rows: edges.map((edge) => [
                edge.itemName,
                displayNodeId(edge.source),
                displayNodeId(edge.target),
                edge.isCrossItem ? "Yes" : "No",
                edge.isAmbiguous ? "Yes" : "No",
            ]),
        }),
        [edges],
    );

    return (
        <div className="h-full w-full overflow-auto p-l">
            <DataGrid data={dataTable} theme={theme} />
        </div>
    );
}
