/**
 * Base State Manager
 * Provides common state management functionality for all state managers
 *
 * Eliminates duplicate subscribe/listener patterns from:
 * - PanelStateManager
 * - ReviewStateManager
 * - SessionStateManager (if any)
 */

/**
 * Generic state listener type
 */
export type StateListener<T> = (state: T, prevState: T) => void;

/**
 * State selector type for selective subscriptions
 */
export type StateSelector<T, S> = (state: T) => S;

/**
 * Abstract base class for state managers
 *
 * @template T - The state type managed by this manager
 *
 * Usage:
 * ```typescript
 * interface MyState {
 *   count: number;
 *   name: string;
 * }
 *
 * class MyStateManager extends BaseStateManager<MyState> {
 *   constructor() {
 *     super({ count: 0, name: "" });
 *   }
 *
 *   increment(): void {
 *     this.setState({ count: this.state.count + 1 });
 *   }
 * }
 * ```
 */
export abstract class BaseStateManager<T extends object> {
	protected state: T;
	private listeners: Set<StateListener<T>> = new Set();

	constructor(initialState: T) {
		this.state = initialState;
	}

	/**
	 * Get current state (immutable copy)
	 */
	getState(): T {
		return { ...this.state };
	}

	/**
	 * Update state with partial updates
	 * Notifies all listeners of the change
	 *
	 * @param partial - Partial state to merge
	 */
	protected setState(partial: Partial<T>): void {
		const prevState = this.state;
		this.state = { ...this.state, ...partial };
		this.notifyListeners(prevState);
	}

	/**
	 * Replace the entire state
	 * Use with caution - prefer setState for partial updates
	 *
	 * @param newState - The new complete state
	 */
	protected replaceState(newState: T): void {
		const prevState = this.state;
		this.state = newState;
		this.notifyListeners(prevState);
	}

	/**
	 * Subscribe to state changes
	 * Returns unsubscribe function
	 *
	 * @param listener - Callback invoked on state change
	 * @returns Unsubscribe function
	 */
	subscribe(listener: StateListener<T>): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Subscribe to specific state changes using a selector
	 * Only notifies when selected value changes (shallow comparison)
	 *
	 * @param selector - Function to select part of state
	 * @param listener - Callback invoked when selected value changes
	 * @returns Unsubscribe function
	 */
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

	/**
	 * Get the number of active listeners
	 * Useful for debugging
	 */
	getListenerCount(): number {
		return this.listeners.size;
	}

	/**
	 * Clear all listeners
	 * Use with caution - typically for cleanup
	 */
	clearListeners(): void {
		this.listeners.clear();
	}

	/**
	 * Notify all listeners of a state change
	 */
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

/**
 * Create a simple state manager for basic use cases
 * For more complex state management, extend BaseStateManager
 *
 * @param initialState - The initial state
 * @returns A state manager instance
 */
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
