import { mountPreact } from "@shared/ui/preact/mount";
import { h } from "preact";
import type TrueRecallPlugin from "../../../../../main";
import { ComparisonWidget } from "./ComparisonWidget";
import { DashboardWidget, NoteStatsWidget } from "./DashboardWidget";
import { DecayWidget } from "./DecayWidget";
import { HealthWidget } from "./HealthWidget";
import { HeatmapWidget } from "./HeatmapWidget";
import { LeaderboardWidget } from "./LeaderboardWidget";
import { NoteHealthWidget } from "./NoteHealthWidget";
import { ProjectHubWidget } from "./ProjectHubWidget";
import { ProjectWidget } from "./ProjectWidget";
import { StreakWidget } from "./StreakWidget";
import { UnassignedNotesWidget } from "./UnassignedNotesWidget";
import { WorkloadWidget } from "./WorkloadWidget";

export function registerDashboardCodeblocks(plugin: TrueRecallPlugin): void {
	// ── Existing widgets ────────────────────────────────────────

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-dashboard",
		(_source, el, _ctx) => {
			el.addClass("true-recall-codeblock-dashboard");
			const unmount = mountPreact(el, plugin, h(DashboardWidget, null));
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-note-stats",
		(_source, el, ctx) => {
			el.addClass("true-recall-codeblock-note-stats");
			const sourceUid = resolveSourceUid(plugin, ctx.sourcePath);
			const unmount = mountPreact(
				el,
				plugin,
				h(NoteStatsWidget, { sourceUid }),
			);
			registerCleanup(el, unmount);
		},
	);

	// ── Global widgets ──────────────────────────────────────────

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-streak",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-streak");
			const unmount = mountPreact(el, plugin, h(StreakWidget, { source }));
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-health",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-health");
			const unmount = mountPreact(el, plugin, h(HealthWidget, { source }));
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-leaderboard",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-leaderboard");
			const unmount = mountPreact(el, plugin, h(LeaderboardWidget, { source }));
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-heatmap",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-heatmap");
			const unmount = mountPreact(el, plugin, h(HeatmapWidget, { source }));
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-comparison",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-comparison");
			const unmount = mountPreact(el, plugin, h(ComparisonWidget, { source }));
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-workload",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-workload");
			const unmount = mountPreact(el, plugin, h(WorkloadWidget, { source }));
			registerCleanup(el, unmount);
		},
	);

	// ── Project widgets ─────────────────────────────────────────

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-project",
		(source, el, ctx) => {
			el.addClass("true-recall-codeblock-project");
			const unmount = mountPreact(
				el,
				plugin,
				h(ProjectWidget, { source, sourcePath: ctx.sourcePath }),
			);
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-unassigned",
		(_source, el, _ctx) => {
			el.addClass("true-recall-codeblock-unassigned");
			const unmount = mountPreact(el, plugin, h(UnassignedNotesWidget, null));
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-project-hub",
		(_source, el, _ctx) => {
			el.addClass("true-recall-codeblock-project-hub");
			const unmount = mountPreact(el, plugin, h(ProjectHubWidget, null));
			registerCleanup(el, unmount);
		},
	);

	// ── Per-note widgets ────────────────────────────────────────

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-note-health",
		(source, el, ctx) => {
			el.addClass("true-recall-codeblock-note-health");
			const sourceUid = resolveSourceUid(plugin, ctx.sourcePath);
			const unmount = mountPreact(
				el,
				plugin,
				h(NoteHealthWidget, { sourceUid, source }),
			);
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-decay",
		(source, el, ctx) => {
			el.addClass("true-recall-codeblock-decay");
			const sourceUid = resolveSourceUid(plugin, ctx.sourcePath);
			const unmount = mountPreact(
				el,
				plugin,
				h(DecayWidget, { sourceUid, source }),
			);
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
	observer.observe(el.parentElement ?? document.body, {
		childList: true,
		subtree: true,
	});
}
