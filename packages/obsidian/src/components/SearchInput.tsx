import {
	clearSearchValue,
	getSearchValueAfterEscape,
} from "@shared/ui/components/search-input.utils";
import { cn } from "@shared/ui/utils";
import { SearchComponent } from "obsidian";
import { useEffect, useRef } from "preact/hooks";

export interface SearchInputProps {
	value: string;
	placeholder: string;
	onChange: (query: string) => void;
	autoFocus?: boolean;
	class?: string;
	ariaLabel?: string;
	// Deprecated (kept for compatibility with existing callsites).
	size?: "sm" | "md";
	autoComplete?: string;
	disabled?: boolean;
	onFocus?: (event: FocusEvent) => void;
	onBlur?: (event: FocusEvent) => void;
	onKeyDown?: (event: KeyboardEvent) => void;
	onInputElement?: (inputEl: HTMLInputElement | null) => void;
}

export function SearchInput({
	value,
	placeholder,
	onChange,
	autoFocus = false,
	class: cls,
	ariaLabel,
	autoComplete,
	disabled = false,
	onFocus,
	onBlur,
	onKeyDown,
	onInputElement,
}: SearchInputProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const componentRef = useRef<SearchComponent | null>(null);
	const syncingRef = useRef(false);
	const onChangeRef = useRef(onChange);
	const onFocusRef = useRef(onFocus);
	const onBlurRef = useRef(onBlur);
	const onKeyDownRef = useRef(onKeyDown);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		onFocusRef.current = onFocus;
	}, [onFocus]);

	useEffect(() => {
		onBlurRef.current = onBlur;
	}, [onBlur]);

	useEffect(() => {
		onKeyDownRef.current = onKeyDown;
	}, [onKeyDown]);

	useEffect(() => {
		const hostEl = hostRef.current;
		if (!hostEl) return;

		hostEl.innerHTML = "";
		const searchComponent = new SearchComponent(hostEl);
		componentRef.current = searchComponent;
		onInputElement?.(searchComponent.inputEl);

		searchComponent.onChange((next) => {
			if (syncingRef.current) return;
			onChangeRef.current(next);
		});

		const handleFocus = (event: FocusEvent) => {
			onFocusRef.current?.(event);
		};
		const handleBlur = (event: FocusEvent) => {
			onBlurRef.current?.(event);
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			onKeyDownRef.current?.(event);
			if (event.defaultPrevented) return;

			const nextValue = getSearchValueAfterEscape(
				event.key,
				searchComponent.getValue(),
			);
			if (nextValue !== null) {
				event.preventDefault();
				syncingRef.current = true;
				searchComponent.setValue(clearSearchValue());
				syncingRef.current = false;
				onChangeRef.current(nextValue);
			}
		};

		searchComponent.inputEl.addEventListener("focus", handleFocus);
		searchComponent.inputEl.addEventListener("blur", handleBlur);
		searchComponent.inputEl.addEventListener("keydown", handleKeyDown);

		return () => {
			searchComponent.inputEl.removeEventListener("focus", handleFocus);
			searchComponent.inputEl.removeEventListener("blur", handleBlur);
			searchComponent.inputEl.removeEventListener("keydown", handleKeyDown);
			onInputElement?.(null);
			hostEl.innerHTML = "";
			componentRef.current = null;
		};
	}, [onInputElement]);

	useEffect(() => {
		const searchComponent = componentRef.current;
		if (!searchComponent) return;
		if (searchComponent.getValue() === value) return;

		syncingRef.current = true;
		searchComponent.setValue(value);
		syncingRef.current = false;
	}, [value]);

	useEffect(() => {
		const searchComponent = componentRef.current;
		if (!searchComponent) return;

		searchComponent.setPlaceholder(placeholder);
		searchComponent.setDisabled(disabled);
		searchComponent.inputEl.enterKeyHint = "search";
		searchComponent.inputEl.autocapitalize = "off";
		searchComponent.inputEl.spellcheck = false;

		if (ariaLabel ?? placeholder) {
			searchComponent.inputEl.setAttribute(
				"aria-label",
				ariaLabel ?? placeholder,
			);
		}
		if (autoComplete !== undefined) {
			searchComponent.inputEl.setAttribute("autocomplete", autoComplete);
		}
	}, [placeholder, disabled, ariaLabel, autoComplete]);

	useEffect(() => {
		if (!autoFocus) return;
		const id = setTimeout(() => componentRef.current?.inputEl.focus(), 50);
		return () => clearTimeout(id);
	}, [autoFocus]);

	return <div ref={hostRef} class={cn("ep:w-full", cls)} />;
}
