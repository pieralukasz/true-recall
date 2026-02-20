import type { App } from "obsidian";
import { render } from "preact";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";

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
					<button
						type="button"
						class="mod-warning ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all"
						onClick={() => onResolve({ cancelled: false, choice: "upload" })}
					>
						Upload local → server
					</button>
				</div>

				<div class="ep:p-3 ep:bg-obs-secondary ep:border ep:border-obs-border ep:rounded-lg">
					<h4 class="ep:m-0 ep:mb-2 ep:text-ui-small ep:font-semibold">
						Download from server
					</h4>
					<p class="ep:m-0 ep:mb-3 ep:text-ui-small ep:text-obs-muted ep:leading-snug">
						Replace local data with server flashcards. Use this if another
						device has your main data.
					</p>
					<button
						type="button"
						class="mod-warning ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all"
						onClick={() => onResolve({ cancelled: false, choice: "download" })}
					>
						Download server → local
					</button>
				</div>
			</div>

			<div class="ep:flex ep:justify-center ep:pt-2 ep:border-t ep:border-obs-border">
				<button
					type="button"
					class="ep:py-2.5 ep:px-5 ep:rounded-md ep:text-ui-small ep:font-medium ep:cursor-pointer ep:transition-all ep:bg-obs-secondary ep:text-obs-normal ep:border ep:border-obs-border ep:hover:bg-obs-modifier-hover"
					onClick={() => onResolve({ cancelled: true, choice: "cancel" })}
				>
					Cancel
				</button>
			</div>
		</>
	);
}

export class FirstSyncConflictModal extends BasePromiseModal<FirstSyncConflictResult> {
	private unmountBody?: () => void;

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
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}
}
