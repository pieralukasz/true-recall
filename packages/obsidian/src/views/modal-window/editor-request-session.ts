/**
 * The editor request a popout view is currently serving.
 *
 * Callers open a popout by registering a request (id, mode, resolver) and
 * passing only the id through the leaf's view state. The view adopts that
 * request here and settles it exactly once: with the editor's result, or as
 * cancelled when the window goes away first. Every later settle is ignored,
 * so the caller's promise can neither hang nor receive two answers.
 */

export interface PendingEditorRequest<TMode, TResult> {
	mode: TMode;
	resolve: (result: TResult) => void;
}

export interface EditorRequestSessionOptions<TId, TMode, TResult> {
	/** Takes the pending request out of its registry. */
	consume: (requestId: TId) => PendingEditorRequest<TMode, TResult> | undefined;
	/** Result delivered when the request ends without an editor result. */
	cancelledResult: () => TResult;
}

interface ActiveRequest<TId, TMode, TResult> {
	requestId: TId;
	mode: TMode;
	resolve: (result: TResult) => void;
	settled: boolean;
}

export class EditorRequestSession<TId, TMode, TResult> {
	private active: ActiveRequest<TId, TMode, TResult> | null = null;

	constructor(
		private readonly options: EditorRequestSessionOptions<TId, TMode, TResult>,
	) {}

	get requestId(): TId | undefined {
		return this.active?.requestId;
	}

	get mode(): TMode | undefined {
		return this.active?.mode;
	}

	get isActive(): boolean {
		return this.active !== null;
	}

	get isSettled(): boolean {
		return this.active?.settled ?? false;
	}

	/**
	 * Switches to `requestId` when it names a different, still pending
	 * request. A request that was being served is settled as cancelled
	 * first, so replacing it cannot strand its caller.
	 *
	 * Returns true when a new request was adopted.
	 */
	adopt(requestId: TId | null | undefined): boolean {
		if (!requestId || requestId === this.active?.requestId) return false;
		const pending = this.options.consume(requestId);
		if (!pending) return false;
		this.cancel();
		this.active = {
			requestId,
			mode: pending.mode,
			resolve: pending.resolve,
			settled: false,
		};
		return true;
	}

	/** Delivers `result`. Returns false when there was nothing left to settle. */
	settle(result: TResult): boolean {
		const active = this.active;
		if (!active || active.settled) return false;
		active.settled = true;
		active.resolve(result);
		return true;
	}

	/** Settles the request as cancelled if it is still open. */
	cancel(): boolean {
		return this.settle(this.options.cancelledResult());
	}
}
