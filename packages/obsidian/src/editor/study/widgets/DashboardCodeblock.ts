import { h } from "preact";

import { mountPreact } from "@true-recall/obsidian/preact/mount";

import type TrueRecallPlugin from "../../../main";
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
import { AchievementsWidget } from "./gamification/AchievementsWidget";
import { AnswerStreakWidget } from "./gamification/AnswerStreakWidget";
import { CountdownWidget } from "./gamification/CountdownWidget";
import { MaturityWidget } from "./gamification/MaturityWidget";
import { ProgressWidget } from "./gamification/ProgressWidget";
import { RatingsWidget } from "./gamification/RatingsWidget";
import { DecayWidget } from "./note/DecayWidget";
import { NoteHealthWidget } from "./note/NoteHealthWidget";
import { ProjectHubWidget } from "./project/ProjectHubWidget";
import { ProjectWidget } from "./project/ProjectWidget";
import { UnassignedNotesWidget } from "./project/UnassignedNotesWidget";

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

	// ── New global widgets ──────────────────────────────────────

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-progress",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-progress");
			const unmount = mountPreact(el, plugin, h(ProgressWidget, { source }));
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-achievements",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-achievements");
			const unmount = mountPreact(
				el,
				plugin,
				h(AchievementsWidget, { source }),
			);
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-answer-streak",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-answer-streak");
			const unmount = mountPreact(
				el,
				plugin,
				h(AnswerStreakWidget, { source }),
			);
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-countdown",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-countdown");
			const unmount = mountPreact(el, plugin, h(CountdownWidget, { source }));
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-maturity",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-maturity");
			const unmount = mountPreact(el, plugin, h(MaturityWidget, { source }));
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-ratings",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-ratings");
			const unmount = mountPreact(el, plugin, h(RatingsWidget, { source }));
			registerCleanup(el, unmount);
		},
	);

	// ── FSRS management widgets ────────────────────────────────

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-true-retention",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-true-retention");
			const unmount = mountPreact(
				el,
				plugin,
				h(TrueRetentionWidget, { source }),
			);
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-preset-info",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-preset-info");
			const unmount = mountPreact(el, plugin, h(PresetInfoWidget, { source }));
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-problem-cards",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-problem-cards");
			const unmount = mountPreact(
				el,
				plugin,
				h(ProblemCardsWidget, { source }),
			);
			registerCleanup(el, unmount);
		},
	);

	plugin.registerMarkdownCodeBlockProcessor(
		"true-recall-forecast",
		(source, el, _ctx) => {
			el.addClass("true-recall-codeblock-forecast");
			const unmount = mountPreact(el, plugin, h(ForecastWidget, { source }));
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
