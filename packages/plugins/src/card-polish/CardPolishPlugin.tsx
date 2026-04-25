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
		this.registerReviewCommands();
	}

	private registerReviewCommands(): void {
		const userPresets = this.pluginCtx.settings.cardPolish?.userPresets ?? [];
		// Register one command per preset so each shows up in the command palette
		// and can be bound to a hotkey via Obsidian's native Hotkeys settings.
		// Looking the preset up by id at invocation time (rather than capturing
		// the closure) keeps the command honoring live edits to the preset.
		for (const declared of [...CARD_POLISH_BUILTINS, ...userPresets]) {
			const id = `card-polish-${declared.id}`;
			const presetId = declared.id;
			this.pluginCtx.obsidianPlugin.addCommand({
				id,
				name: `Polish: ${declared.name}`,
				checkCallback: (checking) => {
					const leaf = this.pluginCtx.workspace.activeLeaf;
					const viewType = leaf?.view?.getViewType?.() ?? "";
					if (viewType !== VIEW_TYPE_REVIEW) return false;
					const preset = this.getPresets().find((p) => p.id === presetId);
					if (!preset) return false;
					if (!checking) {
						const anchor =
							(leaf?.view?.containerEl.querySelector(
								"[data-card-polish-anchor]",
							) as HTMLElement | null) ??
							leaf?.view?.containerEl ??
							null;
						if (!anchor) return false;
						void this.runPreset(preset, { kind: "review", anchor });
					}
					return true;
				},
			});
		}
	}
}
