/** A single object (table or view) tracked by the metadata catalog. */
export interface LineageNode {
    /** Index signature so this type satisfies React Flow's `Node<T extends Record<string, unknown>>`. */
    [key: string]: unknown;
    /** Stable key: `{itemName}.{schemaName}.{objectName}`. */
    id: string;
    itemName: string;
    itemType: string;
    schemaName: string;
    objectName: string;
    objectType: string;
    createdAt: Date | null;
    modifiedAt: Date | null;
    /** SQL text, present only for VIEW objects that resolved to a view definition. */
    viewDefinition: string | null;
    /** True when the catalog only knows about this node via a dependency edge (source/target id with no matching Objects row). */
    isPlaceholder: boolean;
    /** Number of edges where this node is the target (i.e. consumes upstream data). */
    inDegree: number;
    /** Number of edges where this node is the source (i.e. feeds downstream objects). */
    outDegree: number;
}

/** A single upstream -> downstream dependency between two nodes. */
export interface LineageEdge {
    id: string;
    /** Upstream node id (feeds data into `target`). */
    source: string;
    /** Downstream node id (consumes data from `source`). */
    target: string;
    itemName: string;
    referencingObject: string;
    referencedObject: string;
    referencedType: string;
    isCrossItem: boolean;
    isAmbiguous: boolean;
}

export interface LineageGraph {
    nodes: LineageNode[];
    edges: LineageEdge[];
}
