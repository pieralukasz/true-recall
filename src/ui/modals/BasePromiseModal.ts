/**
 * Base Promise Modal
 * Extends BaseModal with generic promise-based open/close pattern
 *
 * This eliminates the duplicate openAndWait() pattern found in:
 * - SessionModal
 * - FlashcardEditorModal
 * - MoveCardModal
 * - MediaPickerModal
 * - ImagePickerModal
 * - FlashcardReviewModal
 */
import { App } from "obsidian";
import { BaseModal, type BaseModalOptions } from "./BaseModal";

/**
 * Abstract base class for modals that return a result via promise
 *
 * @template T - The result type returned when the modal closes
 *
 * Usage:
 * ```typescript
 * class MyModal extends BasePromiseModal<MyResult> {
 *   protected getDefaultResult(): MyResult {
 *     return { cancelled: true };
 *   }
 *
 *   protected renderBody(container: HTMLElement): void {
 *     // Render UI, call this.resolve(result) when done
 *   }
 * }
 *
 * // Usage
 * const modal = new MyModal(app, options);
 * const result = await modal.openAndWait();
 * ```
 */
export abstract class BasePromiseModal<T> extends BaseModal {
	protected resolvePromise: ((result: T) => void) | null = null;
	protected hasResolved = false;

	constructor(app: App, options: BaseModalOptions) {
		super(app, options);
	}

	/**
	 * Open the modal and wait for a result
	 * Returns a promise that resolves when the modal closes
	 */
	async openAndWait(): Promise<T> {
		return new Promise((resolve) => {
			this.resolvePromise = resolve;
			this.open();
		});
	}

	/**
	 * Resolve the modal with a result and close it
	 * This is the preferred way to close the modal with a success result
	 *
	 * @param result - The result to return
	 */
	protected resolve(result: T): void {
		if (this.hasResolved) return;

		this.hasResolved = true;
		if (this.resolvePromise) {
			this.resolvePromise(result);
			this.resolvePromise = null;
		}
		this.close();
	}

	/**
	 * Get the default result to return when modal is closed without explicit resolution
	 * Typically returns a "cancelled" result
	 *
	 * Must be implemented by subclasses
	 */
	protected abstract getDefaultResult(): T;

	/**
	 * Override onClose to ensure promise is always resolved
	 * Subclasses should call super.onClose() if they override this
	 */
	onClose(): void {
		if (!this.hasResolved && this.resolvePromise) {
			this.resolvePromise(this.getDefaultResult());
			this.resolvePromise = null;
		}

		const { contentEl } = this;
		contentEl.empty();
	}
}

/**
 * Common result type for modals with simple cancelled state
 */
export interface CancellableResult {
	cancelled: boolean;
}

/**
 * Helper to create a cancelled result
 */
export function createCancelledResult<T extends CancellableResult>(
	additionalProps?: Partial<Omit<T, "cancelled">>
): T {
	return {
		cancelled: true,
		...additionalProps,
	} as T;
}
