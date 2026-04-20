import type { CardAITarget } from "@true-recall/core";
import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";

import { CardAIPluginBase } from "../shared/CardAIPluginBase";
import {
	DraftCardTarget,
	type DraftCardTargetDetail,
} from "../shared/DraftCardTarget";
import { ReviewCardTarget } from "../shared/ReviewCardTarget";
import type { PluginContext } from "../types";
import { CARD_POLISH_BUILTINS } from "./builtins";

export type CardPolishEventDetail =
	| { kind: "review"; anchor: HTMLElement }
	| ({ kind: "draft"; anchor: HTMLElement } & DraftCardTargetDetail);

export class CardPolishPlugin extends CardAIPluginBase<CardPolishEventDetail> {
	private readonly pluginCtx: PluginContext;

	constructor(ctx: PluginContext) {
		super(ctx, {
			eventName: "true-recall:card-polish",
			bucketKey: "cardPolish",
			builtins: CARD_POLISH_BUILTINS,
			capabilityTag: "card-polish",
			buildTarget: (detail): CardAITarget | null => {
				if (detail.kind === "review") {
					return new ReviewCardTarget(ctx.obsidianPlugin);
				}
				return new DraftCardTarget({
					fields: detail.fields,
					noteType: detail.noteType,
					sourceUid: detail.sourceUid,
					currentCardId: detail.currentCardId,
					onApply: detail.onApply,
				});
			},
		});
		this.pluginCtx = ctx;
	}

	override activate(): void {
		super.activate();
		this.registerReviewHotkeys();
	}

	private registerReviewHotkeys(): void {
		const userPresets = this.pluginCtx.settings.cardPolish?.userPresets ?? [];
		for (const preset of [...CARD_POLISH_BUILTINS, ...userPresets]) {
			if (!preset.hotkey) continue;
			const id = `card-polish-${preset.id}`;
			this.pluginCtx.obsidianPlugin.addCommand({
				id,
				name: `Polish: ${preset.name}`,
				checkCallback: (checking) => {
					const leaf = this.pluginCtx.workspace.activeLeaf;
					const viewType = leaf?.view?.getViewType?.() ?? "";
					if (viewType !== VIEW_TYPE_REVIEW) return false;
					if (!checking) {
						const anchor =
							(leaf?.view?.containerEl.querySelector(
								"[data-card-polish-anchor]",
							) as HTMLElement | null) ??
							leaf?.view?.containerEl ??
							null;
						if (!anchor) return false;
						window.dispatchEvent(
							new CustomEvent("true-recall:card-polish", {
								detail: { kind: "review", anchor },
							}),
						);
					}
					return true;
				},
			});
		}
	}
}
