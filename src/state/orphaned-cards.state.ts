/**
 * Orphaned Cards State Manager
 * Centralized state management for the orphaned cards view
 */
import type {
	OrphanedCardsState,
	OrphanedCardsStateListener,
	PartialOrphanedCardsState,
	OrphanedCard,
} from "./state.types";

/**
 * Creates the initial orphaned cards state
 */
function createInitialState(): OrphanedCardsState {
	return {
		isLoading: true,
		allOrphanedCards: [],
		searchQuery: "",
		selectedCardIds: new Set(),
	};
}

/**
 * Centralized state manager for the orphaned cards view
 */
export class OrphanedCardsStateManager {
	private state: OrphanedCardsState;
	private listeners: Set<OrphanedCardsStateListener> = new Set();

	constructor() {
		this.state = createInitialState();
	}

	/**
	 * Get current state (immutable copy)
	 */
	getState(): OrphanedCardsState {
		return {
			...this.state,
			allOrphanedCards: [...this.state.allOrphanedCards],
			selectedCardIds: new Set(this.state.selectedCardIds),
		};
	}

	/**
	 * Update state with partial updates
	 */
	setState(partial: PartialOrphanedCardsState): void {
		const prevState = this.state;

		// Handle selectedCardIds conversion
		let selectedCardIds = this.state.selectedCardIds;
		if (partial.selectedCardIds !== undefined) {
			selectedCardIds = partial.selectedCardIds instanceof Set
				? partial.selectedCardIds
				: new Set(partial.selectedCardIds);
		}

		this.state = {
			...this.state,
			...partial,
			selectedCardIds,
		};
		this.notifyListeners(prevState);
	}

	/**
	 * Subscribe to state changes
	 */
	subscribe(listener: OrphanedCardsStateListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	/**
	 * Reset state to initial values
	 */
	reset(): void {
		const prevState = this.state;
		this.state = createInitialState();
		this.notifyListeners(prevState);
	}

	// ===== Convenience Methods =====

	/**
	 * Set loading state
	 */
	setLoading(isLoading: boolean): void {
		this.setState({ isLoading });
	}

	/**
	 * Set all orphaned cards
	 */
	setOrphanedCards(cards: OrphanedCard[]): void {
		this.setState({
			allOrphanedCards: cards,
			isLoading: false,
		});
	}

	/**
	 * Set search query
	 */
	setSearchQuery(query: string): void {
		this.setState({ searchQuery: query });
	}

	/**
	 * Toggle card selection
	 */
	toggleCardSelection(cardId: string): void {
		const newSelection = new Set(this.state.selectedCardIds);
		if (newSelection.has(cardId)) {
			newSelection.delete(cardId);
		} else {
			newSelection.add(cardId);
		}
		this.setState({ selectedCardIds: newSelection });
	}

	/**
	 * Select all filtered cards
	 */
	selectAllFiltered(): void {
		const filteredCards = this.getFilteredCards();
		const newSelection = new Set(filteredCards.map(c => c.id));
		this.setState({ selectedCardIds: newSelection });
	}

	/**
	 * Clear selection
	 */
	clearSelection(): void {
		this.setState({ selectedCardIds: new Set() });
	}

	/**
	 * Remove cards from state (after deletion or assignment)
	 */
	removeCards(cardIds: string[]): void {
		const cardIdSet = new Set(cardIds);
		const newCards = this.state.allOrphanedCards.filter(c => !cardIdSet.has(c.id));
		const newSelection = new Set(
			[...this.state.selectedCardIds].filter(id => !cardIdSet.has(id))
		);
		this.setState({
			allOrphanedCards: newCards,
			selectedCardIds: newSelection,
		});
	}

	/**
	 * Get filtered cards based on current state
	 */
	getFilteredCards(): OrphanedCard[] {
		let cards = [...this.state.allOrphanedCards];

		// Apply search filter
		if (this.state.searchQuery) {
			const query = this.state.searchQuery.toLowerCase();
			cards = cards.filter(
				(card) =>
					card.question.toLowerCase().includes(query) ||
					card.answer.toLowerCase().includes(query)
			);
		}

		return cards;
	}

	// ===== Private Methods =====

	private notifyListeners(prevState: OrphanedCardsState): void {
		const currentState = this.state;
		this.listeners.forEach((listener) => {
			try {
				listener(currentState, prevState);
			} catch (error) {
				console.error("Error in orphaned cards state listener:", error);
			}
		});
	}
}

/**
 * Create a new OrphanedCardsStateManager instance
 */
export function createOrphanedCardsStateManager(): OrphanedCardsStateManager {
	return new OrphanedCardsStateManager();
}
