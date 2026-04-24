import { type App, Modal, Notice } from "obsidian";
import { render } from "preact";

import type {
	CardAIPresentArgs,
	CardAIPresenter,
	CardFields,
} from "@true-recall/core";

import { CardAIPreviewModal } from "./CardAIPreviewModal";
import { handleCardAIError } from "./card-ai-error-handler";

export class ObsidianCardAIPresenter implements CardAIPresenter {
	constructor(private readonly app: App) {}

	async present(args: CardAIPresentArgs): Promise<void> {
		if (args.autoApply && args.proposed) {
			this.applyWithUndo(args.target, args.original, args.proposed);
			return;
		}
		await this.openPreview(args);
	}

	private applyWithUndo(
		target: CardAIPresentArgs["target"],
		original: CardFields,
		proposed: CardFields,
	): void {
		const applied = target.apply(proposed);
		if (!applied) {
			new Notice("AI: target unavailable — changes were not applied.");
			return;
		}
		const notice = new Notice("AI changes applied.", 10_000);
		const btn = document.createElement("button");
		btn.textContent = "Undo";
		btn.className = "mod-cta";
		btn.style.marginLeft = "8px";
		btn.onclick = () => {
			target.apply(original);
			notice.hide();
		};
		notice.noticeEl.appendChild(btn);
	}

	private openPreview(args: CardAIPresentArgs): Promise<void> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.titleEl.setText("AI preview");
			let proposal = args.proposed;
			let raw = args.rawResponse;
			const host = modal.contentEl.createDiv();

			const mount = () => {
				render(
					<CardAIPreviewModal
						original={args.original}
						proposed={proposal}
						rawResponse={raw}
						onAccept={() => {
							if (proposal) args.target.apply(proposal);
							modal.close();
						}}
						onReject={() => modal.close()}
						onRetry={async (extra) => {
							try {
								proposal = await args.retry(extra);
								raw = undefined;
								mount();
							} catch (err) {
								handleCardAIError(err, {
									onRawFallback: (rawResponse) => {
										proposal = null;
										raw = rawResponse;
										mount();
									},
								});
							}
						}}
					/>,
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
