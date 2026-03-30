import { usePlugin } from "@shared/ui/preact";
import type { TFile } from "obsidian";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type {
	CardContextItem,
	ContextItem,
	NoteContextItem,
} from "./context.types";

interface AutoContextState {
	activeNote: NoteContextItem | null;
	reviewCard: CardContextItem | null;
}

export function useAutoContext(): {
	autoItems: ContextItem[];
	dismissedKeys: Set<string>;
	dismiss: (key: string) => void;
} {
	const plugin = usePlugin();
	const [state, setState] = useState<AutoContextState>({
		activeNote: null,
		reviewCard: null,
	});
	const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

	const resolveNote = useCallback(
		(file: TFile | null): NoteContextItem | null => {
			if (!file || file.extension !== "md") return null;

			let sourceUid: string | undefined;
			let cardCount: number | undefined;

			if (plugin.frontmatterIndex) {
				const cache = plugin.app.metadataCache.getFileCache(file);
				sourceUid = (cache?.frontmatter?.flashcard_uid as string) ?? undefined;
				if (sourceUid && plugin.cardStore?.cards) {
					cardCount =
						plugin.cardStore.cards.getCardsBySourceUid(sourceUid).length;
				}
			}

			return {
				kind: "active-note",
				path: file.path,
				basename: file.basename,
				sourceUid,
				cardCount,
				auto: true,
			};
		},
		[plugin],
	);

	// Track active note via workspace events
	useEffect(() => {
		const ws = plugin.app.workspace;

		const update = () => {
			const file = ws.getActiveFile();
			setState((prev) => ({ ...prev, activeNote: resolveNote(file) }));
		};

		// Initial state
		update();

		const refs = [
			ws.on("file-open", update),
			ws.on("active-leaf-change", update),
		];

		return () => {
			for (const ref of refs) ws.offref(ref);
		};
	}, [plugin, resolveNote]);

	// Track review card via Zustand store
	const storeRef = useRef(plugin.store);
	storeRef.current = plugin.store;

	useEffect(() => {
		const store = storeRef.current;
		if (!store) return;

		const updateCard = () => {
			const review = store.getState().review;
			const card = review.getCurrentCard();
			if (!card) {
				setState((prev) => ({ ...prev, reviewCard: null }));
				return;
			}
			setState((prev) => ({
				...prev,
				reviewCard: {
					kind: "review-card",
					cardId: card.id,
					question:
						card.question.length > 60
							? `${card.question.slice(0, 57)}...`
							: card.question,
					sourceNoteName: card.sourceNoteName,
					auto: true,
				},
			}));
		};

		updateCard();
		return store.subscribe((s) => s.review, updateCard);
	}, []);

	const dismiss = useCallback((key: string) => {
		setDismissedKeys((prev) => new Set([...prev, key]));
	}, []);

	const autoItems: ContextItem[] = [];
	if (state.activeNote && !dismissedKeys.has(state.activeNote.path)) {
		autoItems.push(state.activeNote);
	}
	if (state.reviewCard && !dismissedKeys.has(state.reviewCard.cardId)) {
		autoItems.push(state.reviewCard);
	}

	return { autoItems, dismissedKeys, dismiss };
}
