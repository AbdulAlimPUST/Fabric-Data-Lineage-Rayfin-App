import { useMemo } from "react";
import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
import { buildLineageGraph } from "@/lib/lineage/build-graph";
import { lineageObjects, lineageDependencies, lineageViewDefinitions } from "@/queries/lineage";
import type { LineageGraph } from "@/lib/lineage/types";

interface UseLineageGraphResult {
    graph: LineageGraph | undefined;
    isLoading: boolean;
    error: Error | undefined;
    refetch: () => Promise<void>;
}

/**
 * Fetches the three metadata tables (Objects, Dependencies, ViewDefinitions) via
 * DAX and joins them into a single `LineageGraph`. Since the underlying tables are
 * Direct Lake, `refetch({ bypassCache: true })` always reflects the current state
 * of the lakehouse's `metadata` schema.
 */
export function useLineageGraph(): UseLineageGraphResult {
    const objectsQuery = lineageObjects();
    const dependenciesQuery = lineageDependencies();
    const viewDefinitionsQuery = lineageViewDefinitions();

    const objects = useSemanticModelQuery(objectsQuery);
    const dependencies = useSemanticModelQuery(dependenciesQuery);
    const viewDefinitions = useSemanticModelQuery(viewDefinitionsQuery);

    const isLoading = objects.isLoading || dependencies.isLoading || viewDefinitions.isLoading;
    const error = objects.error ?? dependencies.error ?? viewDefinitions.error;

    const graph = useMemo<LineageGraph | undefined>(() => {
        if (
            objects.data?.status !== "success" ||
            dependencies.data?.status !== "success" ||
            viewDefinitions.data?.status !== "success"
        ) {
            return undefined;
        }
        return buildLineageGraph(objects.data.table, dependencies.data.table, viewDefinitions.data.table);
    }, [objects.data, dependencies.data, viewDefinitions.data]);

    const queryError =
        objects.data?.status === "error"
            ? objects.data.error.message
            : dependencies.data?.status === "error"
              ? dependencies.data.error.message
              : viewDefinitions.data?.status === "error"
                ? viewDefinitions.data.error.message
                : undefined;

    async function refetch() {
        // Explicit bypassCache: true — this is the user hitting "Refresh" wanting the
        // current state of the lakehouse, not whatever the SDK's LRU cache last held.
        await Promise.all([
            objects.refetch({ bypassCache: true }),
            dependencies.refetch({ bypassCache: true }),
            viewDefinitions.refetch({ bypassCache: true }),
        ]);
    }

    return {
        graph,
        isLoading,
        error: error ?? (queryError ? new Error(queryError) : undefined),
        refetch,
    };
}
