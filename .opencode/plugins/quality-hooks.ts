import type { Plugin } from "@opencode-ai/plugin";

const TS_FILE = /\.(ts|tsx)$/;

export const QualityHooks: Plugin = async ({ $ }) => {
	return {
		"tool.execute.after": async (input, _output) => {
			if (input.tool !== "edit" && input.tool !== "write") return;
			const filePath = (input.args as { file_path?: string } | undefined)
				?.file_path;
			if (!filePath || !TS_FILE.test(filePath)) return;

			const result =
				await $`bunx biome check --no-errors-on-unmatched ${filePath}`
					.nothrow()
					.quiet();
			if (result.exitCode !== 0) {
				const out = `${result.stdout?.toString() ?? ""}${result.stderr?.toString() ?? ""}`;
				console.error(
					`[quality-hooks] biome errors in ${filePath}\n${out.trim()}`,
				);
			}
		},

		"session.idle": async () => {
			const result = await $`bun run build`.nothrow().quiet();
			if (result.exitCode !== 0) {
				const tail = (result.stderr?.toString() ?? "")
					.split("\n")
					.slice(-30)
					.join("\n");
				console.error(`[quality-hooks] build failed:\n${tail}`);
			}
		},
	};
};
