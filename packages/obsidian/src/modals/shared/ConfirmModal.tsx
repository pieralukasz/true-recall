import { Clickable } from "@true-recall/obsidian/components";
import type { App } from "obsidian";
import { render } from "preact";
import { BasePromiseModal } from "./BasePromiseModal";

export interface ConfirmResult {
	confirmed: boolean;
}

export interface ConfirmModalOptions {
	title?: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
}

export class ConfirmModal extends BasePromiseModal<ConfirmResult> {
	private options: ConfirmModalOptions;

	constructor(app: App, options: ConfirmModalOptions) {
		super(app, {
			title: options.title ?? "Confirm",
			width: "400px",
		});
		this.options = options;
	}

	protected getDefaultResult(): ConfirmResult {
		return { confirmed: false };
	}

	protected renderBody(container: HTMLElement): void {
		const handleConfirm = () => this.resolve({ confirmed: true });
		const handleCancel = () => this.resolve({ confirmed: false });

		render(
			<div>
				<p class="ep:text-obs-normal ep:leading-relaxed ep:mb-4">
					{this.options.message}
				</p>
				<div class="ep:flex ep:justify-end ep:gap-2">
					<Clickable
						class="ep-btn ep-btn-outline"
						onClick={handleCancel}
						stopPropagation={false}
					>
						{this.options.cancelLabel ?? "Cancel"}
					</Clickable>
					<Clickable
						class="mod-cta ep-btn"
						onClick={handleConfirm}
						stopPropagation={false}
					>
						{this.options.confirmLabel ?? "Confirm"}
					</Clickable>
				</div>
			</div>,
			container,
		);
	}
}

export async function confirm(
	app: App,
	options: ConfirmModalOptions,
): Promise<boolean> {
	const modal = new ConfirmModal(app, options);
	const result = await modal.openAndWait();
	return result.confirmed;
}
