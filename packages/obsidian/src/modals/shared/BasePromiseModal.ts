import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";

export abstract class BasePromiseModal<T> extends BaseModal {
	protected resolvePromise: ((result: T) => void) | null = null;
	protected hasResolved = false;

	async openAndWait(): Promise<T> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	protected resolve(result: T): void {
		if (this.hasResolved) return;

		this.hasResolved = true;
		if (this.resolvePromise) {
			this.resolvePromise(result);
			this.resolvePromise = null;
		}
		this.close();
	}

	protected abstract getDefaultResult(): T;

	onClose(): void {
		// Unmount Preact tree first (via BaseModal)
		super.onClose();

		if (!this.hasResolved && this.resolvePromise) {
			this.resolvePromise(this.getDefaultResult());
			this.resolvePromise = null;
		}
	}
}

export interface CancellableResult {
	cancelled: boolean;
}
