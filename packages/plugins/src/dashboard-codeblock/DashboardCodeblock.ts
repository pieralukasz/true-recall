import { h } from "preact";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { mountPreact } from "@true-recall/obsidian/preact/mount";

import { ComparisonWidget } from "./analytics/ComparisonWidget";
import { HealthWidget } from "./analytics/HealthWidget";
import { HeatmapWidget } from "./analytics/HeatmapWidget";
import { LeaderboardWidget } from "./analytics/LeaderboardWidget";
import { StreakWidget } from "./analytics/StreakWidget";
import { WorkloadWidget } from "./analytics/WorkloadWidget";
import { DashboardWidget, NoteStatsWidget } from "./DashboardWidget";
import { ForecastWidget } from "./fsrs/ForecastWidget";
import { PresetInfoWidget } from "./fsrs/PresetInfoWidget";
import { ProblemCardsWidget } from "./fsrs/ProblemCardsWidget";
import { TrueRetentionWidget } from "./fsrs/TrueRetentionWidget";
import { DecayWidget } from "./note/DecayWidget";
import { NoteHealthWidget } from "./note/NoteHealthWidget";
import { ProjectHubWidget } from "./project/ProjectHubWidget";
import { ProjectWidget } from "./project/ProjectWidget";
import { UnassignedNotesWidget } from "./project/UnassignedNotesWidget";

// ── Shared utilities ───────────────────────────────────────

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
	observer.observe(el.parentElement ?? activeDocument.body, {
		childList: true,
		subtree: true,
	});
}

// ── Core dashboard codeblocks ──────────────────────────────

type CodeBlockHandler = Parameters<
	TrueRecallPlugin["registerMarkdownCodeBlockProcessor"]
>[1];

export function registerCoreDashboardCodeblocks(
	plugin: TrueRecallPlugin,
	isEnabled: () => boolean,
): void {
	// Codeblock processors can't be unregistered mid-session, so each handler
	// is gated live — disabling the plugin leaves the codeblocks unrendered.
	const register = (language: string, handler: CodeBlockHandler) => {
		plugin.registerMarkdownCodeBlockProcessor(language, (source, el, ctx) => {
			if (!isEnabled()) return;
			return handler(source, el, ctx);
		});
	};

	register("true-recall-dashboard", (_source, el, _ctx) => {
		el.addClass("true-recall-codeblock-dashboard");
		const unmount = mountPreact(el, plugin, h(DashboardWidget, null));
		registerCleanup(el, unmount);
	});

	register("true-recall-note-stats", (_source, el, ctx) => {
		el.addClass("true-recall-codeblock-note-stats");
		const sourceUid = resolveSourceUid(plugin, ctx.sourcePath);
		const unmount = mountPreact(el, plugin, h(NoteStatsWidget, { sourceUid }));
		registerCleanup(el, unmount);
	});

	register("true-recall-streak", (source, el, _ctx) => {
		el.addClass("true-recall-codeblock-streak");
		const unmount = mountPreact(el, plugin, h(StreakWidget, { source }));
		registerCleanup(el, unmount);
	});

	register("true-recall-health", (source, el, _ctx) => {
		el.addClass("true-recall-codeblock-health");
		const unmount = mountPreact(el, plugin, h(HealthWidget, { source }));
		registerCleanup(el, unmount);
	});

	register("true-recall-leaderboard", (source, el, _ctx) => {
		el.addClass("true-recall-codeblock-leaderboard");
		const unmount = mountPreact(el, plugin, h(LeaderboardWidget, { source }));
		registerCleanup(el, unmount);
	});

	register("true-recall-heatmap", (source, el, _ctx) => {
		el.addClass("true-recall-codeblock-heatmap");
		const unmount = mountPreact(el, plugin, h(HeatmapWidget, { source }));
		registerCleanup(el, unmount);
	});

	register("true-recall-comparison", (source, el, _ctx) => {
		el.addClass("true-recall-codeblock-comparison");
		const unmount = mountPreact(el, plugin, h(ComparisonWidget, { source }));
		registerCleanup(el, unmount);
	});

	register("true-recall-workload", (source, el, _ctx) => {
		el.addClass("true-recall-codeblock-workload");
		const unmount = mountPreact(el, plugin, h(WorkloadWidget, { source }));
		registerCleanup(el, unmount);
	});

	// ── Project widgets ─────────────────────────────────────────

	register("true-recall-project", (source, el, ctx) => {
		el.addClass("true-recall-codeblock-project");
		const unmount = mountPreact(
			el,
			plugin,
			h(ProjectWidget, { source, sourcePath: ctx.sourcePath }),
		);
		registerCleanup(el, unmount);
	});

	register("true-recall-unassigned", (_source, el, _ctx) => {
		el.addClass("true-recall-codeblock-unassigned");
		const unmount = mountPreact(el, plugin, h(UnassignedNotesWidget, null));
		registerCleanup(el, unmount);
	});

	register("true-recall-project-hub", (_source, el, _ctx) => {
		el.addClass("true-recall-codeblock-project-hub");
		const unmount = mountPreact(el, plugin, h(ProjectHubWidget, null));
		registerCleanup(el, unmount);
	});

	// ── FSRS management widgets ────────────────────────────────

	register("true-recall-true-retention", (source, el, _ctx) => {
		el.addClass("true-recall-codeblock-true-retention");
		const unmount = mountPreact(el, plugin, h(TrueRetentionWidget, { source }));
		registerCleanup(el, unmount);
	});

	register("true-recall-preset-info", (source, el, _ctx) => {
		el.addClass("true-recall-codeblock-preset-info");
		const unmount = mountPreact(el, plugin, h(PresetInfoWidget, { source }));
		registerCleanup(el, unmount);
	});

	register("true-recall-problem-cards", (source, el, _ctx) => {
		el.addClass("true-recall-codeblock-problem-cards");
		const unmount = mountPreact(el, plugin, h(ProblemCardsWidget, { source }));
		registerCleanup(el, unmount);
	});

	register("true-recall-forecast", (source, el, _ctx) => {
		el.addClass("true-recall-codeblock-forecast");
		const unmount = mountPreact(el, plugin, h(ForecastWidget, { source }));
		registerCleanup(el, unmount);
	});

	// ── Per-note widgets ────────────────────────────────────────

	register("true-recall-note-health", (source, el, ctx) => {
		el.addClass("true-recall-codeblock-note-health");
		const sourceUid = resolveSourceUid(plugin, ctx.sourcePath);
		const unmount = mountPreact(
			el,
			plugin,
			h(NoteHealthWidget, { sourceUid, source }),
		);
		registerCleanup(el, unmount);
	});

	register("true-recall-decay", (source, el, ctx) => {
		el.addClass("true-recall-codeblock-decay");
		const sourceUid = resolveSourceUid(plugin, ctx.sourcePath);
		const unmount = mountPreact(
			el,
			plugin,
			h(DecayWidget, { sourceUid, source }),
		);
		registerCleanup(el, unmount);
	});
}
