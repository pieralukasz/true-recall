import {
	AbstractInputSuggest,
	type App,
	TextComponent,
	TFolder,
} from "obsidian";
import { useEffect, useMemo, useRef } from "preact/hooks";

import { cn } from "@true-recall/obsidian/utils";

export interface FolderSuggestInputProps {
	app: App;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	class?: string;
}

class FolderSuggest extends AbstractInputSuggest<string> {
	private readonly getFolders: () => string[];
	private readonly onPick: (folder: string) => void;

	constructor(
		app: App,
		inputEl: HTMLInputElement,
		getFolders: () => string[],
		onPick: (folder: string) => void,
	) {
		super(app, inputEl);
		this.getFolders = getFolders;
		this.onPick = onPick;
	}

	protected getSuggestions(query: string): string[] {
		const folders = this.getFolders();
		if (!query.trim()) return folders.slice(0, 50);
		const q = query.toLowerCase();
		return folders.filter((f) => f.toLowerCase().includes(q)).slice(0, 50);
	}

	renderSuggestion(folder: string, el: HTMLElement): void {
		const lastSlash = folder.lastIndexOf("/");
		const name = lastSlash >= 0 ? folder.slice(lastSlash + 1) : folder;
		const parent = lastSlash >= 0 ? folder.slice(0, lastSlash) : null;

		const titleEl = el.ownerDocument.createElement("div");
		titleEl.className = "suggestion-title";
		titleEl.textContent = name;
		el.appendChild(titleEl);

		if (parent) {
			const noteEl = el.ownerDocument.createElement("div");
			noteEl.className = "suggestion-note";
			noteEl.textContent = parent;
			el.appendChild(noteEl);
		}
	}

	selectSuggestion(folder: string): void {
		this.onPick(folder);
		this.close();
	}
}

export function FolderSuggestInput({
	app,
	value,
	onChange,
	placeholder,
	class: cls,
}: FolderSuggestInputProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const componentRef = useRef<TextComponent | null>(null);
	const suggestRef = useRef<FolderSuggest | null>(null);
	const syncingRef = useRef(false);
	const onChangeRef = useRef(onChange);

	const allFolders = useMemo(
		() =>
			app.vault
				.getAllLoadedFiles()
				.filter((f): f is TFolder => f instanceof TFolder && f.path !== "/")
				.map((f) => f.path)
				.sort((a, b) => a.localeCompare(b)),
		[app],
	);

	const foldersRef = useRef(allFolders);
	useEffect(() => {
		foldersRef.current = allFolders;
	}, [allFolders]);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

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

		const suggest = new FolderSuggest(
			app,
			textComponent.inputEl,
			() => foldersRef.current,
			(folder) => {
				syncingRef.current = true;
				textComponent.setValue(folder);
				syncingRef.current = false;
				onChangeRef.current(folder);
			},
		);
		suggestRef.current = suggest;

		return () => {
			suggestRef.current?.close();
			hostEl.innerHTML = "";
			componentRef.current = null;
			suggestRef.current = null;
		};
	}, [app]);

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
		if (placeholder) {
			textComponent.inputEl.setAttribute("aria-label", placeholder);
		}
	}, [placeholder]);

	return <div ref={hostRef} class={cn("ep:w-full", cls)} />;
}
