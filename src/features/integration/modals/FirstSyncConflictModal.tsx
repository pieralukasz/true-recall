import { Clickable } from "@shared/ui/components";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import type { App } from "obsidian";
import { render } from "preact";

export type FirstSyncChoice = "upload" | "download" | "cancel";

export interface FirstSyncConflictResult {
	cancelled: boolean;
	choice: FirstSyncChoice;
}

function FirstSyncConflictBody({
	onResolve,
}: {
	onResolve: (result: FirstSyncConflictResult) => void;
}) {
	return (
		<>
			<div class="ep:mb-4">
				<p class="ep:m-0 ep:mb-2 ep:leading-normal">
					This device has never been synced before, but there is data both
					locally and on the server.
				</p>
				<p class="mod-warning ep:m-0 ep:leading-normal ep:text-obs-warning ep:font-medium">
					You must choose which data to keep. The other will be permanently
					lost.
				</p>
			</div>

			<div class="ep:flex ep:flex-col ep:gap-4 ep:mb-4">
				<div class="ep:p-3 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-lg">
					<h4 class="ep:m-0 ep:mb-2 ep:text-ui-small ep:font-semibold">
						Upload to server
					</h4>
					<p class="ep:m-0 ep:mb-3 ep:text-ui-small ep:text-obs-muted ep:leading-snug">
						Replace server data with your local flashcards. Use this if your
						local data is more complete.
					</p>
					<Clickable
						stopPropagation={false}
						class="mod-warning ep-btn"
						onClick={() => onResolve({ cancelled: false, choice: "upload" })}
					>
						Upload local → server
					</Clickable>
				</div>

				<div class="ep:p-3 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-lg">
					<h4 class="ep:m-0 ep:mb-2 ep:text-ui-small ep:font-semibold">
						Download from server
					</h4>
					<p class="ep:m-0 ep:mb-3 ep:text-ui-small ep:text-obs-muted ep:leading-snug">
						Replace local data with server flashcards. Use this if another
						device has your main data.
					</p>
					<Clickable
						stopPropagation={false}
						class="mod-warning ep-btn"
						onClick={() => onResolve({ cancelled: false, choice: "download" })}
					>
						Download server → local
					</Clickable>
				</div>
			</div>

			<div class="ep-modal-footer ep:flex ep:justify-center">
				<Clickable
					stopPropagation={false}
					class="ep-btn ep-btn-outline"
					onClick={() => onResolve({ cancelled: true, choice: "cancel" })}
				>
					Cancel
				</Clickable>
			</div>
		</>
	);
}

export class FirstSyncConflictModal extends BasePromiseModal<FirstSyncConflictResult> {
	constructor(app: App) {
		super(app, {
			title: "First Sync Conflict",
			width: "450px",
		});
	}

	protected getDefaultResult(): FirstSyncConflictResult {
		return { cancelled: true, choice: "cancel" };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<FirstSyncConflictBody onResolve={(result) => this.resolve(result)} />,
			container,
		);
	}
}
