import { SearchInput } from "@shared/ui/components/SearchInput";
import {
	filterNotesByQuery,
	MAX_DISPLAY_NOTES,
} from "@shared/ui/modals/note-filter.utils";
import { cn } from "@shared/ui/utils/cn";
import type { App, TFile } from "obsidian";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";

export interface NotePickerComboboxProps {
	app: App;
	selectedNote: TFile | null;
	onSelect: (note: TFile | null) => void;
}

export function NotePickerCombobox({
	app,
	selectedNote,
	onSelect,
}: NotePickerComboboxProps) {
	const listRef = useRef<HTMLUListElement>(null);
	const [inputValue, setInputValue] = useState(selectedNote?.basename ?? "");
	const [query, setQuery] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [highlightIndex, setHighlightIndex] = useState(-1);

	const allNotes = useMemo(() => app.vault.getMarkdownFiles(), [app]);

	const filtered = useMemo(
		() => filterNotesByQuery(allNotes, query).slice(0, MAX_DISPLAY_NOTES),
		[allNotes, query],
	);

	// Sync input text when selectedNote changes externally.
	useEffect(() => {
		setInputValue(selectedNote?.basename ?? "");
	}, [selectedNote]);

	const selectNote = useCallback(
		(file: TFile) => {
			onSelect(file);
			setInputValue(file.basename);
			setQuery("");
			setIsOpen(false);
			setHighlightIndex(-1);
		},
		[onSelect],
	);

	const handleInput = useCallback((value: string) => {
		setInputValue(value);
		setQuery(value);
		setIsOpen(true);
		setHighlightIndex(-1);
	}, []);

	const handleFocus = useCallback(() => {
		setIsOpen(true);
	}, []);

	const handleBlur = useCallback(
		(e: FocusEvent) => {
			// Don't close if focus moved to dropdown items
			const related = e.relatedTarget as HTMLElement | null;
			if (related && listRef.current?.contains(related)) return;

			// Restore previous selection on blur without new selection
			setInputValue(selectedNote?.basename ?? "");
			setIsOpen(false);
			setQuery("");
			setHighlightIndex(-1);
		},
		[selectedNote],
	);

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
						selectNote(target);
					}
					break;
				}
				case "Escape":
					e.preventDefault();
					setIsOpen(false);
					setHighlightIndex(-1);
					setInputValue(selectedNote?.basename ?? "");
					setQuery("");
					break;
			}
		},
		[isOpen, filtered, highlightIndex, selectNote, selectedNote],
	);

	// Scroll highlighted item into view
	useEffect(() => {
		if (highlightIndex < 0 || !listRef.current) return;
		const item = listRef.current.children[highlightIndex] as HTMLElement;
		item?.scrollIntoView({ block: "nearest" });
	}, [highlightIndex]);

	return (
		<div class="ep:relative">
			<SearchInput
				value={inputValue}
				placeholder="Search notes..."
				ariaLabel="Search notes"
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
						"ep:absolute ep:right-0 ep:top-full ep:mt-1 ep:z-50",
						"ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg",
						"ep:max-h-[280px] ep:overflow-y-auto ep:py-1 ep:min-w-full ep:w-[420px] ep:max-w-[90vw]",
					)}
				>
					{filtered.map((note, index) => {
						const folderPath = note.parent?.path;
						return (
							<li
								key={note.path}
								tabIndex={-1}
								class={cn(
									"ep:px-3 ep:py-1.5 ep:cursor-pointer ep:text-ui-small ep:flex ep:items-center ep:gap-2",
									highlightIndex === index
										? "ep:bg-obs-modifier-hover ep:text-obs-normal"
										: "ep:text-obs-muted",
								)}
								onMouseDown={(e) => {
									e.preventDefault();
									selectNote(note);
								}}
								onMouseEnter={() => setHighlightIndex(index)}
							>
								<span class="ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap ep:shrink">
									{note.basename}
								</span>
								{folderPath && folderPath !== "/" && (
									<span class="ep:text-[11px] ep:text-obs-faint ep:shrink-0">
										{folderPath}
									</span>
								)}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
