import { cn } from "@shared/ui/utils";
import { TextComponent } from "obsidian";
import { useEffect, useRef } from "preact/hooks";

export interface TextInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	type?: "text" | "password" | "email" | "url" | "search" | "tel";
	class?: string;
	disabled?: boolean;
	autoFocus?: boolean;
	ariaLabel?: string;
	autoComplete?: string;
	inputMode?: string;
	enterKeyHint?: string;
	autoCapitalize?: string;
	spellcheck?: boolean;
	id?: string;
	name?: string;
	onKeyDown?: (event: KeyboardEvent) => void;
	onFocus?: (event: FocusEvent) => void;
	onBlur?: (event: FocusEvent) => void;
}

export function TextInput({
	value,
	onChange,
	placeholder,
	type = "text",
	class: cls,
	disabled = false,
	autoFocus = false,
	ariaLabel,
	autoComplete,
	inputMode,
	enterKeyHint,
	autoCapitalize,
	spellcheck,
	id,
	name,
	onKeyDown,
	onFocus,
	onBlur,
}: TextInputProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const componentRef = useRef<TextComponent | null>(null);
	const syncingRef = useRef(false);
	const onChangeRef = useRef(onChange);
	const onKeyDownRef = useRef(onKeyDown);
	const onFocusRef = useRef(onFocus);
	const onBlurRef = useRef(onBlur);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		onKeyDownRef.current = onKeyDown;
	}, [onKeyDown]);

	useEffect(() => {
		onFocusRef.current = onFocus;
	}, [onFocus]);

	useEffect(() => {
		onBlurRef.current = onBlur;
	}, [onBlur]);

	useEffect(() => {
		const hostEl = hostRef.current;
		if (!hostEl) return;

		hostEl.innerHTML = "";
		const textComponent = new TextComponent(hostEl);
		componentRef.current = textComponent;

		textComponent.onChange((next) => {
			if (syncingRef.current) return;
			onChangeRef.current(next);
		});

		const handleKeyDown = (event: KeyboardEvent) => {
			onKeyDownRef.current?.(event);
		};
		const handleFocus = (event: FocusEvent) => {
			onFocusRef.current?.(event);
		};
		const handleBlur = (event: FocusEvent) => {
			onBlurRef.current?.(event);
		};

		textComponent.inputEl.addEventListener("keydown", handleKeyDown);
		textComponent.inputEl.addEventListener("focus", handleFocus);
		textComponent.inputEl.addEventListener("blur", handleBlur);

		return () => {
			textComponent.inputEl.removeEventListener("keydown", handleKeyDown);
			textComponent.inputEl.removeEventListener("focus", handleFocus);
			textComponent.inputEl.removeEventListener("blur", handleBlur);
			hostEl.innerHTML = "";
			componentRef.current = null;
		};
	}, []);

	useEffect(() => {
		const textComponent = componentRef.current;
		if (!textComponent) return;
		if (textComponent.getValue() === value) return;

		syncingRef.current = true;
		textComponent.setValue(value);
		syncingRef.current = false;
	}, [value]);

	useEffect(() => {
		const textComponent = componentRef.current;
		if (!textComponent) return;

		textComponent.setPlaceholder(placeholder ?? "");
		textComponent.setDisabled(disabled);
		textComponent.inputEl.type = type;

		if (ariaLabel ?? placeholder) {
			textComponent.inputEl.setAttribute("aria-label", ariaLabel ?? placeholder ?? "");
		}
		if (autoComplete !== undefined) {
			textComponent.inputEl.setAttribute("autocomplete", autoComplete);
		}
		if (inputMode !== undefined) {
			textComponent.inputEl.setAttribute("inputmode", inputMode);
		}
		if (enterKeyHint !== undefined) {
			textComponent.inputEl.setAttribute("enterkeyhint", enterKeyHint);
		}
		if (autoCapitalize !== undefined) {
			textComponent.inputEl.autocapitalize = autoCapitalize;
		}
		if (spellcheck !== undefined) {
			textComponent.inputEl.spellcheck = spellcheck;
		}
		if (id !== undefined) {
			textComponent.inputEl.id = id;
		}
		if (name !== undefined) {
			textComponent.inputEl.name = name;
		}
	}, [
		placeholder,
		disabled,
		type,
		ariaLabel,
		autoComplete,
		inputMode,
		enterKeyHint,
		autoCapitalize,
		spellcheck,
		id,
		name,
	]);

	useEffect(() => {
		if (!autoFocus) return;
		const id = setTimeout(() => componentRef.current?.inputEl.focus(), 50);
		return () => clearTimeout(id);
	}, [autoFocus]);

	return <div ref={hostRef} class={cn("ep:w-full", cls)} />;
}
