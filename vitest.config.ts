//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["src/test/setup.ts"],
        globals: true,
    },
    resolve: {
        alias: { "@": resolve(import.meta.dirname, "src") },
    },
    ssr: {
        // @microsoft/fabric-datagrid is externalized by default and loaded via
        // Node's native resolver, so its own `import ... from "@fluentui/react-icons"`
        // never passes through Vite. That package's ESM build re-exports
        // extensionless relative paths, which Node's strict ESM resolution
        // rejects (even though its CJS build works fine). Forcing both through
        // Vite's own transform (which tolerates extensionless imports) fixes it.
        noExternal: ["@microsoft/fabric-datagrid", /@fluentui\/react-icons/],
    },
});
