/** @jsxImportSource react */
import { MarkdownRenderer, Component as ObsidianComponent } from "obsidian";
import { createContext, memo, useContext, useEffect, useRef } from "react";

import type TrueRecallPlugin from "../../../main";

export const PluginContext = createContext<TrueRecallPlugin | null>(null);

export function usePlugin(): TrueRecallPlugin {
	const plugin = useContext(PluginContext);
	if (!plugin) throw new Error("PluginContext missing");
	return plugin;
}

/** Obsidian's own Markdown renderer, so bold, math and wikilinks look like the vault. */
export const ObsidianMarkdown = memo(function ObsidianMarkdown({
	markdown,
	className,
}: {
	markdown: string;
	className?: string;
}) {
	const plugin = usePlugin();
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		el.empty();
		const owner = new ObsidianComponent();
		owner.load();
		void MarkdownRenderer.render(plugin.app, markdown, el, "", owner);
		return () => owner.unload();
	}, [markdown, plugin]);
	return <div ref={ref} className={`tr-ai-chat__md ${className ?? ""}`} />;
});
