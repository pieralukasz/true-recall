/**
 * Decides whether an editor window may close, for every close path: the
 * editor's own close request, Escape, and the OS closing the popout.
 *
 * - A clean editor closes immediately.
 * - A dirty editor asks once. While that question is open, further close
 *   requests are answered "not now" instead of opening a second dialog; the
 *   open dialog's answer decides.
 * - Once the user confirmed the discard, nothing blocks the window anymore,
 *   including the native unload prompt.
 *
 * The guard owns no UI. The adapter supplies `confirmDiscard`, which must
 * settle when its signal aborts (the window is closing or the session was
 * replaced) so no dialog outlives the editor it belongs to.
 */

export type ConfirmDiscard = (signal: AbortSignal) => Promise<boolean>;

export class EditorCloseGuard {
	private dirty = false;
	private discardConfirmed = false;
	private confirmation: AbortController | null = null;
	private unload: {
		win: Window;
		handler: (event: BeforeUnloadEvent) => void;
	} | null = null;

	constructor(private readonly confirmDiscard: ConfirmDiscard) {}

	setDirty(dirty: boolean): void {
		this.dirty = dirty;
	}

	/** True while closing would lose content the user has not given up. */
	get hasUnsavedChanges(): boolean {
		return this.dirty && !this.discardConfirmed;
	}

	get isConfirming(): boolean {
		return this.confirmation !== null;
	}

	/**
	 * Runs `close` once the editor may close: synchronously for a clean
	 * editor, after a confirmed discard for a dirty one, never when the user
	 * keeps editing or the question is already open.
	 */
	requestClose(close: () => void): void {
		if (this.confirmation) return;
		if (!this.hasUnsavedChanges) {
			close();
			return;
		}
		void this.askToDiscard().then((confirmed) => {
			if (confirmed) close();
		});
	}

	/**
	 * Blocks the OS from closing `win` while there are unsaved changes.
	 * Rebinding moves the listener; `null` only removes it.
	 */
	bindWindow(win: Window | null): void {
		this.unbindWindow();
		if (!win) return;
		const handler = (event: BeforeUnloadEvent) => {
			if (!this.hasUnsavedChanges) return;
			// Makes Electron show its native confirm dialog when the popout is
			// closed via the OS close button. preventDefault() alone is enough;
			// returnValue is no longer required.
			event.preventDefault();
		};
		win.addEventListener("beforeunload", handler);
		this.unload = { win, handler };
	}

	/** Forgets the previous session's state and dismisses its dialog. */
	reset(): void {
		this.abortConfirmation();
		this.dirty = false;
		this.discardConfirmed = false;
	}

	dispose(): void {
		this.abortConfirmation();
		this.unbindWindow();
	}

	private async askToDiscard(): Promise<boolean> {
		const controller = new AbortController();
		this.confirmation = controller;
		try {
			const confirmed = await this.confirmDiscard(controller.signal);
			if (!confirmed || controller.signal.aborted) return false;
			this.discardConfirmed = true;
			return true;
		} finally {
			if (this.confirmation === controller) this.confirmation = null;
		}
	}

	private abortConfirmation(): void {
		const controller = this.confirmation;
		this.confirmation = null;
		controller?.abort();
	}

	private unbindWindow(): void {
		if (this.unload) {
			this.unload.win.removeEventListener("beforeunload", this.unload.handler);
		}
		this.unload = null;
	}
}
