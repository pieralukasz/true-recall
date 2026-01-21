import { defineConfig } from "vitest/config";

export default defineConfig({
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
                "src/view.ts", // Will be refactored later
            ],
        },
        // Ensure TypeScript paths work
        alias: {
            "@": "/src",
            // Mock obsidian module for testing
            "obsidian": new URL("./tests/__mocks__/obsidian.ts", import.meta.url).pathname,
        },
    },
});
