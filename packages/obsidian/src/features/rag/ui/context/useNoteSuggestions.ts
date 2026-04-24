import type { TFile } from "obsidian";
import { useCallback, useMemo, useState } from "preact/hooks";

import {
	filterNotesByQuery,
	MAX_DISPLAY_NOTES,
} from "@true-recall/obsidian/modals/shared/note-filter.utils";
import { useApp } from "@true-recall/obsidian/preact";

const MAX_SUGGESTIONS = 8;

interface HashTrigger {
	active: boolean;
	query: string;
	startIndex: number;
}

interface NoteSuggestionsState {
	isActive: boolean;
	suggestions: TFile[];
	highlightIndex: number;
	selectNext: () => void;
	selectPrev: () => void;
	setIndex: (i: number) => void;
	confirm: () => TFile | null;
	close: () => void;
	handleTrigger: (text: string, cursorPos: number) => void;
}

export function useNoteSuggestions(): NoteSuggestionsState {
	const app = useApp();
	const [trigger, setTrigger] = useState<HashTrigger>({
		active: false,
		query: "",
		startIndex: 0,
	});
	const [highlightIndex, setHighlightIndex] = useState(0);

	const allNotes = useMemo(
		() => app.vault.getMarkdownFiles(),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[app, trigger.query],
	);

	const suggestions = useMemo(() => {
		if (!trigger.active) return [];
		return filterNotesByQuery(allNotes, trigger.query).slice(
			0,
			Math.min(MAX_SUGGESTIONS, MAX_DISPLAY_NOTES),
		);
	}, [allNotes, trigger.active, trigger.query]);

	const handleTrigger = useCallback((text: string, cursorPos: number) => {
		let hashIdx = -1;
		for (let i = cursorPos - 1; i >= 0; i--) {
			const ch = text[i];
			if (ch === "#") {
				if (i === 0 || /\s/.test(text[i - 1] ?? "")) {
					hashIdx = i;
				}
				break;
			}
			if (ch === "\n" || ch === "\r") break;
		}

		if (hashIdx >= 0) {
			const query = text.slice(hashIdx + 1, cursorPos);
			setTrigger({ active: true, query, startIndex: hashIdx });
			setHighlightIndex(0);
		} else {
			setTrigger({ active: false, query: "", startIndex: 0 });
		}
	}, []);

	const selectNext = useCallback(() => {
		setHighlightIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
	}, [suggestions.length]);

	const selectPrev = useCallback(() => {
		setHighlightIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
	}, [suggestions.length]);

	const confirm = useCallback((): TFile | null => {
		const file = suggestions[highlightIndex] ?? null;
		setTrigger({ active: false, query: "", startIndex: 0 });
		setHighlightIndex(0);
		return file;
	}, [suggestions, highlightIndex]);

	const close = useCallback(() => {
		setTrigger({ active: false, query: "", startIndex: 0 });
		setHighlightIndex(0);
	}, []);

	const setIndex = useCallback((i: number) => setHighlightIndex(i), []);

	return {
		isActive: trigger.active && suggestions.length > 0,
		suggestions,
		highlightIndex,
		selectNext,
		selectPrev,
		setIndex,
		confirm,
		close,
		handleTrigger,
	};
}

export function getTriggerRange(
	text: string,
	cursorPos: number,
): { start: number; end: number } | null {
	for (let i = cursorPos - 1; i >= 0; i--) {
		const ch = text[i];
		if (ch === "#") {
			if (i === 0 || /\s/.test(text[i - 1] ?? "")) {
				return { start: i, end: cursorPos };
			}
			return null;
		}
		if (ch === "\n" || ch === "\r") return null;
	}
	return null;
}
