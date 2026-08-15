import type { ColumnMetadataMap } from "@/lib/to-data-table";
import query from "./objects.dax?raw";

const connection = "lineageModel";

/** Column metadata keyed by original DAX column name. */
export const objectsColumnMetadata: ColumnMetadataMap = {
    "objects[workspace_name]": { name: "WorkspaceName", displayName: "Workspace Name" },
    "objects[workspace_id]": { name: "WorkspaceId", displayName: "Workspace Id" },
    "objects[item_name]": { name: "ItemName", displayName: "Item Name" },
    "objects[item_type]": { name: "ItemType", displayName: "Item Type" },
    "objects[schema_name]": { name: "SchemaName", displayName: "Schema Name" },
    "objects[object_name]": { name: "ObjectName", displayName: "Object Name" },
    "objects[object_type]": { name: "ObjectType", displayName: "Object Type" },
    "objects[node_id]": { name: "NodeId", displayName: "Node Id" },
    "objects[created_at]": { name: "CreatedAt", displayName: "Created At", format: "mm/dd/yyyy hh:mm" },
    "objects[modified_at]": { name: "ModifiedAt", displayName: "Modified At", format: "mm/dd/yyyy hh:mm" },
    "objects[extracted_at_utc]": { name: "ExtractedAtUtc", displayName: "Extracted At (UTC)", format: "mm/dd/yyyy hh:mm" },
};

export function lineageObjects() {
    return { connection, query, columnMetadata: objectsColumnMetadata };
}
