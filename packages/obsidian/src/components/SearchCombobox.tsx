import { AbstractInputSuggest, type App, SearchComponent } from "obsidian";
import { useEffect, useRef } from "preact/hooks";

import {
	type SectionedSuggestion,
	withSectionLabels,
} from "@true-recall/obsidian/components/search-combobox.utils";
import { replaceTokenAtCursor } from "@true-recall/obsidian/helpers/search-suggestions";
import type { SuggestionProvider } from "@true-recall/obsidian/helpers/search-suggestions.types";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import { cn } from "@true-recall/obsidian/utils/cn";

interface SearchComboboxProps {
	value: string;
	placeholder: string;
	onChange: (query: string) => void;
	getSuggestions?: SuggestionProvider;
	autoFocus?: boolean;
	class?: string;
	// Deprecated (kept for compatibility with existing callsites).
	showSearchIcon?: boolean;
	ariaLabel?: string;
	// Deprecated (kept for compatibility with existing callsites).
	size?: "sm" | "md";
}

class SearchComboboxSuggest extends AbstractInputSuggest<SectionedSuggestion> {
	private readonly getList: (query: string) => SectionedSuggestion[];
	private readonly onPick: (
		value: SectionedSuggestion,
		evt: MouseEvent | KeyboardEvent,
	) => void;

	constructor(
		app: App,
		inputEl: HTMLInputElement,
		getList: (query: string) => SectionedSuggestion[],
		onPick: (
			value: SectionedSuggestion,
			evt: MouseEvent | KeyboardEvent,
		) => void,
	) {
		super(app, inputEl);
		this.getList = getList;
		this.onPick = onPick;
		this.limit = 200;
	}

	protected getSuggestions(query: string): SectionedSuggestion[] {
		return this.getList(query);
	}

	renderSuggestion(value: SectionedSuggestion, el: HTMLElement): void {
		el.textContent = "";

		if (value.showSectionLabel) {
			el.createDiv({
				cls: "true-recall-search-suggest-section",
				text: value.sectionLabel,
			});
		}

		el.createDiv({ cls: "suggestion-title", text: value.label });

		if (value.description) {
			el.createDiv({ cls: "suggestion-note", text: value.description });
		}
	}

	selectSuggestion(
		value: SectionedSuggestion,
		evt: MouseEvent | KeyboardEvent,
	): void {
		this.onPick(value, evt);
		this.close();
	}
}

export function SearchCombobox({
	value,
	placeholder,
	onChange,
	getSuggestions,
	autoFocus = false,
	class: cls,
	ariaLabel,
}: SearchComboboxProps) {
	const app = useApp();
	const hostRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<SearchComponent | null>(null);
	const suggestRef = useRef<SearchComboboxSuggest | null>(null);
	const onChangeRef = useRef(onChange);
	const getSuggestionsRef = useRef(getSuggestions);
	const syncingRef = useRef(false);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		getSuggestionsRef.current = getSuggestions;
	}, [getSuggestions]);

	useEffect(() => {
		const hostEl = hostRef.current;
		if (!hostEl) return;

		hostEl.innerHTML = "";
		const searchComponent = new SearchComponent(hostEl);
		searchRef.current = searchComponent;

		searchComponent.onChange((next) => {
			if (syncingRef.current) return;
			onChangeRef.current(next);
		});

		if (getSuggestionsRef.current) {
			const suggest = new SearchComboboxSuggest(
				app,
				searchComponent.inputEl,
				(query) => {
					const cursorPos =
						searchComponent.inputEl.selectionStart ?? query.length;
					const suggestions =
						getSuggestionsRef.current?.(query, cursorPos) ?? [];
					return withSectionLabels(suggestions);
				},
				(suggestion) => {
					const inputEl = searchComponent.inputEl;
					const cursorPos = inputEl.selectionStart ?? inputEl.value.length;
					const { text, cursor } = replaceTokenAtCursor(
						inputEl.value,
						cursorPos,
						suggestion.insertText,
					);

					syncingRef.current = true;
					searchComponent.setValue(text);
					syncingRef.current = false;
					onChangeRef.current(text);
					window.requestAnimationFrame(() => {
						const nextInput = searchRef.current?.inputEl;
						if (!nextInput) return;
						nextInput.focus();
						nextInput.setSelectionRange(cursor, cursor);
					});
				},
			);
			suggestRef.current = suggest;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			const currentValue = searchComponent.getValue();
			if (currentValue.length > 0) {
				event.preventDefault();
				syncingRef.current = true;
				searchComponent.setValue("");
				syncingRef.current = false;
				onChangeRef.current("");
				return;
			}
			suggestRef.current?.close();
		};

		searchComponent.inputEl.addEventListener("keydown", handleKeyDown);

		return () => {
			searchComponent.inputEl.removeEventListener("keydown", handleKeyDown);
			suggestRef.current?.close();
			hostEl.innerHTML = "";
			suggestRef.current = null;
			searchRef.current = null;
		};
	}, [app]);

	useEffect(() => {
		const searchComponent = searchRef.current;
		if (!searchComponent) return;
		if (searchComponent.getValue() === value) return;

		syncingRef.current = true;
		searchComponent.setValue(value);
		syncingRef.current = false;
	}, [value]);

	useEffect(() => {
		const searchComponent = searchRef.current;
		if (!searchComponent) return;

		searchComponent.setPlaceholder(placeholder);
		searchComponent.inputEl.enterKeyHint = "search";
		searchComponent.inputEl.autocapitalize = "off";
		searchComponent.inputEl.spellcheck = false;
		searchComponent.inputEl.setAttribute(
			"aria-label",
			ariaLabel ?? placeholder,
		);
	}, [placeholder, ariaLabel]);

	useEffect(() => {
		if (!autoFocus) return;
		const id = window.setTimeout(() => searchRef.current?.inputEl.focus(), 50);
		return () => window.clearTimeout(id);
	}, [autoFocus]);

	return <div ref={hostRef} class={cn("ep:w-full", cls)} />;
}
