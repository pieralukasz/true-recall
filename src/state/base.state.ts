export type StateListener<T> = (state: T, prevState: T) => void;

export type StateSelector<T, S> = (state: T) => S;

export abstract class BaseStateManager<T extends object> {
	protected state: T;
	private listeners: Set<StateListener<T>> = new Set();

	constructor(initialState: T) {
		this.state = initialState;
	}

	getState(): T {
		return { ...this.state };
	}

	protected setState(partial: Partial<T>): void {
		const prevState = this.state;
		this.state = { ...this.state, ...partial };
		this.notifyListeners(prevState);
	}

	protected replaceState(newState: T): void {
		const prevState = this.state;
		this.state = newState;
		this.notifyListeners(prevState);
	}

	subscribe(listener: StateListener<T>): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/** Only notifies when selected value changes (shallow comparison) */
	subscribeToSelector<S>(
		selector: StateSelector<T, S>,
		listener: (value: S, prevValue: S) => void
	): () => void {
		let prevValue = selector(this.state);

		const wrappedListener: StateListener<T> = (state) => {
			const newValue = selector(state);
			if (newValue !== prevValue) {
				const oldValue = prevValue;
				prevValue = newValue;
				listener(newValue, oldValue);
			}
		};

		this.listeners.add(wrappedListener);
		return () => this.listeners.delete(wrappedListener);
	}

	getListenerCount(): number {
		return this.listeners.size;
	}

	clearListeners(): void {
		this.listeners.clear();
	}

	private notifyListeners(prevState: T): void {
		const currentState = this.state;
		this.listeners.forEach((listener) => {
			try {
				listener(currentState, prevState);
			} catch (error) {
				console.error("[BaseStateManager] Error in state listener:", error);
			}
		});
	}
}

export function createSimpleStateManager<T extends object>(
	initialState: T
): BaseStateManager<T> & { updateState: (partial: Partial<T>) => void } {
	class SimpleStateManager extends BaseStateManager<T> {
		updateState(partial: Partial<T>): void {
			this.setState(partial);
		}
	}

	return new SimpleStateManager(initialState);
}
