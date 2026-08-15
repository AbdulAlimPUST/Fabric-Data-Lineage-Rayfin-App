import type { ColumnMetadataMap } from "@/lib/to-data-table";
import query from "./dependencies.dax?raw";

const connection = "lineageModel";

/** Column metadata keyed by original DAX column name. */
export const dependenciesColumnMetadata: ColumnMetadataMap = {
    "dependencies[workspace_name]": { name: "WorkspaceName", displayName: "Workspace Name" },
    "dependencies[workspace_id]": { name: "WorkspaceId", displayName: "Workspace Id" },
    "dependencies[item_name]": { name: "ItemName", displayName: "Item Name" },
    "dependencies[item_type]": { name: "ItemType", displayName: "Item Type" },
    "dependencies[referencing_schema]": { name: "ReferencingSchema", displayName: "Referencing Schema" },
    "dependencies[referencing_object]": { name: "ReferencingObject", displayName: "Referencing Object" },
    "dependencies[referencing_type]": { name: "ReferencingType", displayName: "Referencing Type" },
    "dependencies[referenced_db]": { name: "ReferencedDb", displayName: "Referenced Db" },
    "dependencies[referenced_schema]": { name: "ReferencedSchema", displayName: "Referenced Schema" },
    "dependencies[referenced_object]": { name: "ReferencedObject", displayName: "Referenced Object" },
    "dependencies[referenced_type]": { name: "ReferencedType", displayName: "Referenced Type" },
    "dependencies[source_id]": { name: "SourceId", displayName: "Source Id" },
    "dependencies[target_id]": { name: "TargetId", displayName: "Target Id" },
    "dependencies[is_cross_item]": { name: "IsCrossItem", displayName: "Cross-Item" },
    "dependencies[is_ambiguous]": { name: "IsAmbiguous", displayName: "Ambiguous" },
    "dependencies[extracted_at_utc]": { name: "ExtractedAtUtc", displayName: "Extracted At (UTC)", format: "mm/dd/yyyy hh:mm" },
    "dependencies[resolved_type]": { name: "ResolvedType", displayName: "Resolved Type" },
    "dependencies[source_node_id]": { name: "SourceNodeId", displayName: "Source Node Id" },
    "dependencies[match_kind]": { name: "MatchKind", displayName: "Match Kind" },
};

export function lineageDependencies() {
    return { connection, query, columnMetadata: dependenciesColumnMetadata };
}
