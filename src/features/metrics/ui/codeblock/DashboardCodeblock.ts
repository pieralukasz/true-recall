import { mountPreact } from "@shared/ui/preact/mount";
import { h } from "preact";
import type TrueRecallPlugin from "../../../../main";
import { DashboardWidget, NoteStatsWidget } from "./DashboardWidget";

export function registerDashboardCodeblocks(plugin: TrueRecallPlugin): void {
	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-dashboard",
		(_source, el, _ctx) => {
			el.addClass("true-recall-codeblock-dashboard");
			const unmount = mountPreact(el, plugin, h(DashboardWidget, null));
			// Obsidian will remove el from DOM on navigation — Preact cleanup is automatic
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-note-stats",
		(_source, el, ctx) => {
			el.addClass("true-recall-codeblock-note-stats");

			const sourceUid = resolveSourceUid(plugin, ctx.sourcePath);
			const unmount = mountPreact(el, plugin, h(NoteStatsWidget, { sourceUid }));
			registerCleanup(el, unmount);
		},
	);
}

function resolveSourceUid(
	plugin: TrueRecallPlugin,
	sourcePath: string,
): string | null {
	const file = plugin.app.vault.getAbstractFileByPath(sourcePath);
	if (!file) return null;

	const uids = plugin.frontmatterIndex.getValues("flashcard_uid", sourcePath);
	return uids[0] ?? null;
}

function registerCleanup(el: HTMLElement, unmount: () => void): void {
	const observer = new MutationObserver(() => {
		if (!el.isConnected) {
			unmount();
			observer.disconnect();
		}
	});
	observer.observe(el.parentElement ?? document.body, { childList: true, subtree: true });
}
