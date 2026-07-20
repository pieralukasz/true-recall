import type { Extension } from "@codemirror/state";

interface InkEmbeddableEditorApi {
	getEmbeddableEditorExtensions?: (sourcePath: string) => Extension[];
}

interface AppWithPluginManager {
	plugins?: {
		getPlugin?: (id: string) => unknown;
		manifests?: Record<string, unknown>;
	};
}

export type InkIntegrationStatus =
	| "ready"
	| "incompatible"
	| "disabled"
	| "not-installed";

function getLoadedInkPlugin(app: unknown): InkEmbeddableEditorApi | null {
	const pluginManager = (app as AppWithPluginManager).plugins;
	return (pluginManager?.getPlugin?.("ink") as InkEmbeddableEditorApi) ?? null;
}

export function getInkIntegrationStatus(app: unknown): InkIntegrationStatus {
	const pluginManager = (app as AppWithPluginManager).plugins;
	const inkPlugin = getLoadedInkPlugin(app);

	if (inkPlugin) {
		return typeof inkPlugin.getEmbeddableEditorExtensions === "function"
			? "ready"
			: "incompatible";
	}

	return pluginManager?.manifests?.ink ? "disabled" : "not-installed";
}

/**
 * Resolve the optional Ink integration without making True Recall depend on
 * Ink at build time. An empty list keeps EmbeddableEditor usable when Ink is
 * disabled, missing, or older than the shared-editor API.
 */
export function getInkEmbeddableEditorExtensions(
	app: unknown,
	sourcePath: string,
): Extension[] {
	const inkPlugin = getLoadedInkPlugin(app);

	return inkPlugin?.getEmbeddableEditorExtensions?.(sourcePath) ?? [];
}
