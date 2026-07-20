import { TFolder } from "obsidian";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";

import { Clickable } from "@true-recall/obsidian/components";
import { SearchInput } from "@true-recall/obsidian/components/SearchInput";
import { useIcon } from "@true-recall/obsidian/preact";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import { cn } from "@true-recall/obsidian/utils";

interface FolderPickerProps {
	value: string[];
	onChange: (folders: string[]) => void;
	placeholder?: string;
}

function FolderTag({ path, onRemove }: { path: string; onRemove: () => void }) {
	const iconRef = useIcon("x");

	return (
		<span class="ep:inline-flex ep:items-center ep:gap-1 ep:px-2 ep:py-0.5 ep:rounded ep:bg-obs-modifier-hover ep:text-ui-smaller ep:text-obs-normal ep:max-w-full">
			<span class="ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap ep:shrink">
				{path}
			</span>
			<Clickable
				class="ep:flex ep:items-center ep:shrink-0 ep:opacity-60 ep:hover:opacity-100"
				onClick={onRemove}
				aria-label={`Remove ${path}`}
			>
				<div ref={iconRef} class="ep:w-3 ep:h-3" />
			</Clickable>
		</span>
	);
}

export function FolderPicker({
	value,
	onChange,
	placeholder = "Search folders...",
}: FolderPickerProps) {
	const app = useApp();
	const listRef = useRef<HTMLUListElement>(null);
	const [query, setQuery] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [highlightIndex, setHighlightIndex] = useState(-1);

	const selectedSet = useMemo(() => new Set(value), [value]);

	const allFolders = useMemo(
		() =>
			app.vault
				.getAllLoadedFiles()
				.filter((f): f is TFolder => f instanceof TFolder && f.path !== "/")
				.map((f) => f.path)
				.sort((a, b) => a.localeCompare(b)),
		[app],
	);

	const filtered = useMemo(() => {
		const available = allFolders.filter((f) => !selectedSet.has(f));
		if (!query.trim()) return available.slice(0, 50);
		const q = query.toLowerCase();
		return available.filter((f) => f.toLowerCase().includes(q)).slice(0, 50);
	}, [allFolders, selectedSet, query]);

	const addFolder = useCallback(
		(folder: string) => {
			onChange([...value, folder]);
			setQuery("");
			setIsOpen(false);
			setHighlightIndex(-1);
		},
		[value, onChange],
	);

	const removeFolder = useCallback(
		(folder: string) => {
			onChange(value.filter((f) => f !== folder));
		},
		[value, onChange],
	);

	const handleFocus = useCallback(() => {
		setIsOpen(true);
	}, []);

	const handleBlur = useCallback((e: FocusEvent) => {
		const related = e.relatedTarget as HTMLElement | null;
		if (related && listRef.current?.contains(related)) return;
		setIsOpen(false);
		setQuery("");
		setHighlightIndex(-1);
	}, []);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (!isOpen && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					if (!isOpen) {
						setIsOpen(true);
						setHighlightIndex(0);
					} else {
						setHighlightIndex((prev) =>
							prev < filtered.length - 1 ? prev + 1 : 0,
						);
					}
					break;
				case "ArrowUp":
					e.preventDefault();
					setHighlightIndex((prev) =>
						prev > 0 ? prev - 1 : filtered.length - 1,
					);
					break;
				case "Enter": {
					e.preventDefault();
					const target = filtered[highlightIndex];
					if (highlightIndex >= 0 && target) {
						addFolder(target);
					}
					break;
				}
				case "Escape":
					e.preventDefault();
					setIsOpen(false);
					setQuery("");
					setHighlightIndex(-1);
					break;
			}
		},
		[isOpen, filtered, highlightIndex, addFolder],
	);

	useEffect(() => {
		if (highlightIndex < 0 || !listRef.current) return;
		const item = listRef.current.children[highlightIndex] as HTMLElement;
		item?.scrollIntoView({ block: "nearest" });
	}, [highlightIndex]);

	const handleInput = useCallback((val: string) => {
		setQuery(val);
		setIsOpen(true);
		setHighlightIndex(-1);
	}, []);

	return (
		<div class="ep:flex ep:flex-col ep:gap-1.5">
			{value.length > 0 && (
				<div class="ep:flex ep:flex-wrap ep:gap-1">
					{value.map((folder) => (
						<FolderTag
							key={folder}
							path={folder}
							onRemove={() => removeFolder(folder)}
						/>
					))}
				</div>
			)}

			<div class="ep:relative">
				<SearchInput
					value={query}
					placeholder={placeholder}
					ariaLabel={placeholder}
					onChange={handleInput}
					onFocus={handleFocus}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					autoComplete="off"
				/>

				{isOpen && filtered.length > 0 && (
					<ul
						ref={listRef}
						class={cn(
							"ep:absolute ep:left-0 ep:right-0 ep:top-full ep:mt-1 ep:z-50",
							"ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg",
							"ep:max-h-[200px] ep:overflow-y-auto ep:py-1",
						)}
					>
						{filtered.map((folder, index) => {
							const lastSlash = folder.lastIndexOf("/");
							const name =
								lastSlash >= 0 ? folder.slice(lastSlash + 1) : folder;
							const parent = lastSlash >= 0 ? folder.slice(0, lastSlash) : null;

							return (
								<li
									key={folder}
									tabIndex={-1}
									class={cn(
										"ep:px-3 ep:py-1.5 ep:cursor-pointer ep:text-ui-small ep:flex ep:items-center ep:gap-2",
										highlightIndex === index
											? "ep:bg-obs-modifier-hover ep:text-obs-normal"
											: "ep:text-obs-muted",
									)}
									onMouseDown={(e) => {
										e.preventDefault();
										addFolder(folder);
									}}
									onMouseEnter={() => setHighlightIndex(index)}
								>
									<span class="ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap ep:shrink">
										{name}
									</span>
									{parent && (
										<span class="ep:text-[11px] ep:text-obs-faint ep:shrink-0">
											{parent}
										</span>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}
