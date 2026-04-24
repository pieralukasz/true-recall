import { h } from "preact";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { mountPreact } from "@true-recall/obsidian/preact/mount";

import { AchievementsWidget } from "./AchievementsWidget";
import { AnswerStreakWidget } from "./AnswerStreakWidget";
import { CountdownWidget } from "./CountdownWidget";
import { MaturityWidget } from "./MaturityWidget";
import { ProgressWidget } from "./ProgressWidget";
import { RatingsWidget } from "./RatingsWidget";

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

export function registerGamificationCodeblocks(plugin: TrueRecallPlugin): void {
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
}
