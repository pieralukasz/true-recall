import { type App, Modal, Notice } from "obsidian";
import { render } from "preact";

import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";

import { CardAIPreviewModal } from "./CardAIPreviewModal";
import type {
	CardAIPresentArgs,
	CardAIPresenter,
	CardAITarget,
	CardFields,
} from "./card-ai";
import { handleCardAIError } from "./card-ai-error-handler";

export class ObsidianCardAIPresenter implements CardAIPresenter {
	constructor(
		private readonly app: App,
		private readonly plugin: TrueRecallPlugin,
	) {}

	async present(args: CardAIPresentArgs): Promise<void> {
		const hasEdits = args.proposed !== null;
		const hasNew = args.proposedNewCards.length > 0;

		// Nothing to apply — model returned [0] verbatim and no new cards.
		if (!hasEdits && !hasNew && !args.rawResponse) {
			new Notice("AI: no changes suggested.");
			return;
		}

		// Edit-only auto-apply (existing behavior preserved).
		if (hasEdits && !hasNew && args.autoApplyEdits && args.proposed) {
			this.applyWithUndo(args.target, args.original, args.proposed, []);
			return;
		}

		// Spawn-only auto-apply.
		if (!hasEdits && hasNew && args.autoApplyNewCards) {
			this.applyWithUndo(
				args.target,
				args.original,
				null,
				args.proposedNewCards,
			);
			return;
		}

		// Edits + spawn, both auto-apply ON.
		if (hasEdits && hasNew && args.autoApplyEdits && args.autoApplyNewCards) {
			this.applyWithUndo(
				args.target,
				args.original,
				args.proposed,
				args.proposedNewCards,
			);
			return;
		}

		// Mixed flags or any preview case → full preview modal.
		await this.openPreview(args);
	}

	private applyWithUndo(
		target: CardAITarget,
		original: CardFields,
		proposed: CardFields | null,
		newCards: CardFields[],
	): void {
		let editsApplied = false;
		if (proposed) {
			editsApplied = target.apply(proposed);
			if (!editsApplied && newCards.length === 0) {
				new Notice("AI: target unavailable — changes were not applied.");
				return;
			}
		}

		const createdIds: string[] = [];
		for (const card of newCards) {
			const ids = target.createCard?.(card);
			if (ids) createdIds.push(...ids);
		}

		const parts: string[] = [];
		if (editsApplied) parts.push("1 edit");
		if (createdIds.length) {
			parts.push(
				`${newCards.length} new card${newCards.length > 1 ? "s" : ""}`,
			);
		}
		if (parts.length === 0) {
			new Notice("AI: target unavailable — changes were not applied.");
			return;
		}

		const notice = new Notice(`AI applied: ${parts.join(" + ")}`, 10_000);
		const btn = document.createElement("button");
		btn.textContent = "Undo";
		btn.className = "mod-cta";
		btn.setCssStyles({ marginLeft: "8px" });
		btn.onclick = () => {
			if (editsApplied) target.apply(original);
			for (const id of createdIds) target.removeCard?.(id);
			notice.hide();
		};
		notice.noticeEl.appendChild(btn);
	}

	private openPreview(args: CardAIPresentArgs): Promise<void> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText("AI preview");
			let proposal = args.proposed;
			let newCards = args.proposedNewCards;
			let raw = args.rawResponse;
			const host = modal.contentEl.createDiv();

			const sourceCardId = args.target.getCurrentCardId();
			const canDeleteSource =
				typeof args.target.removeCard === "function" && !!sourceCardId;

			const mount = () => {
				render(
					<ObsidianProvider value={{ app: this.app, plugin: this.plugin }}>
						<CardAIPreviewModal
							original={args.original}
							proposed={proposal}
							proposedNewCards={newCards}
							rawResponse={raw}
							canDeleteSource={canDeleteSource}
							onAccept={(
								editedProposed,
								editedSelectedNewCards,
								deleteSource,
							) => {
								if (editedProposed) args.target.apply(editedProposed);
								for (const card of editedSelectedNewCards) {
									args.target.createCard?.(card);
								}
								if (deleteSource && sourceCardId) {
									args.target.removeCard?.(sourceCardId);
								}
								modal.close();
							}}
							onReject={() => modal.close()}
							onRetry={async (extra) => {
								try {
									const result = await args.retry(extra);
									proposal = result.edits;
									newCards = result.newCards;
									raw = undefined;
									mount();
								} catch (err) {
									handleCardAIError(err, {
										onRawFallback: (rawResponse) => {
											proposal = null;
											newCards = [];
											raw = rawResponse;
											mount();
										},
									});
								}
							}}
						/>
					</ObsidianProvider>,
					host,
				);
			};
			mount();
			modal.onClose = () => {
				render(null, host);
				resolve();
			};
			modal.open();
		});
	}
}
