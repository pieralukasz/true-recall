import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
    resolve: {
        alias: {
            "@shared": resolve(__dirname, "src/shared"),
            "@features": resolve(__dirname, "src/features"),
        },
    },
    test: {
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
        exclude: ["node_modules", "dist"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "json"],
            include: ["src/**/*.ts"],
            exclude: [
                "src/main.ts",
                "src/**/*.d.ts",
                "src/view.ts", 
            ],
        },
        alias: {
            "@": "/src",
            "types": new URL("./src/types/index.ts", import.meta.url).pathname,
            "obsidian": new URL("./tests/__mocks__/obsidian.ts", import.meta.url).pathname,
            "@sqlite.org/sqlite-wasm/sqlite3.wasm": new URL("./tests/__mocks__/sqlite3.wasm.ts", import.meta.url).pathname,
            "@sqlite.org/sqlite-wasm": new URL("./tests/__mocks__/sqlite-wasm.ts", import.meta.url).pathname,
        },
    },
});
