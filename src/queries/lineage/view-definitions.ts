import type { ColumnMetadataMap } from "@/lib/to-data-table";
import query from "./view-definitions.dax?raw";

const connection = "lineageModel";

/** Column metadata keyed by original DAX column name. */
export const viewDefinitionsColumnMetadata: ColumnMetadataMap = {
    "view_definitions[workspace_name]": { name: "WorkspaceName", displayName: "Workspace Name" },
    "view_definitions[workspace_id]": { name: "WorkspaceId", displayName: "Workspace Id" },
    "view_definitions[item_name]": { name: "ItemName", displayName: "Item Name" },
    "view_definitions[item_type]": { name: "ItemType", displayName: "Item Type" },
    "view_definitions[schema_name]": { name: "SchemaName", displayName: "Schema Name" },
    "view_definitions[view_name]": { name: "ViewName", displayName: "View Name" },
    "view_definitions[node_id]": { name: "NodeId", displayName: "Node Id" },
    "view_definitions[created_at]": { name: "CreatedAt", displayName: "Created At", format: "mm/dd/yyyy hh:mm" },
    "view_definitions[modified_at]": { name: "ModifiedAt", displayName: "Modified At", format: "mm/dd/yyyy hh:mm" },
    "view_definitions[view_definition]": { name: "ViewDefinition", displayName: "View Definition" },
    "view_definitions[extracted_at_utc]": { name: "ExtractedAtUtc", displayName: "Extracted At (UTC)", format: "mm/dd/yyyy hh:mm" },
};

export function lineageViewDefinitions() {
    return { connection, query, columnMetadata: viewDefinitionsColumnMetadata };
}
