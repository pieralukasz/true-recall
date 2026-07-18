import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";

import type { NoteType } from "@true-recall/core/types/note.types";
import { BUILTIN_IMAGE_OCCLUSION_ID } from "@true-recall/core/types/note.types";

import { SearchInput } from "@true-recall/obsidian/components";
import { usePlugin } from "@true-recall/obsidian/preact/ObsidianContext";
import { cn } from "@true-recall/obsidian/utils/cn";

interface NoteTypePickerProps {
	value: string;
	onChange: (noteTypeId: string) => void;
	disabled?: boolean;
}

export function NoteTypePicker({
	value,
	onChange,
	disabled,
}: NoteTypePickerProps) {
	const plugin = usePlugin();
	const listRef = useRef<HTMLUListElement>(null);
	const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [query, setQuery] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [highlightIndex, setHighlightIndex] = useState(-1);

	useEffect(() => {
		if (!plugin.cardStore?.noteTypes) return;
		const all = plugin.cardStore.noteTypes.getAll();
		setNoteTypes(all);
	}, [plugin.cardStore]);

	const sorted = useMemo(() => {
		// Hide Image Occlusion from the add-flashcard picker (not supported here)
		const filtered = noteTypes.filter(
			(nt) => nt.id !== BUILTIN_IMAGE_OCCLUSION_ID,
		);
		const builtins = filtered.filter((nt) => nt.isBuiltin);
		const custom = filtered
			.filter((nt) => !nt.isBuiltin)
			.sort((a, b) => a.name.localeCompare(b.name));
		return [...builtins, ...custom];
	}, [noteTypes]);

	const selected = useMemo(
		() => sorted.find((nt) => nt.id === value) ?? sorted[0] ?? null,
		[sorted, value],
	);

	const filtered = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return sorted;
		return sorted.filter((nt) => {
			const typeLabel = nt.type === 1 ? "cloze" : "basic";
			return (
				nt.name.toLowerCase().includes(normalized) ||
				typeLabel.includes(normalized)
			);
		});
	}, [sorted, query]);

	useEffect(() => {
		setInputValue(selected?.name ?? "");
	}, [selected]);

	const selectNoteType = useCallback(
		(noteType: NoteType) => {
			onChange(noteType.id);
			setInputValue(noteType.name);
			setQuery("");
			setIsOpen(false);
			setHighlightIndex(-1);
		},
		[onChange],
	);

	const handleInput = useCallback((next: string) => {
		setInputValue(next);
		setQuery(next);
		setIsOpen(true);
		setHighlightIndex(0);
	}, []);

	const handleFocus = useCallback(() => {
		if (disabled) return;
		setIsOpen(true);
		setHighlightIndex(0);
	}, [disabled]);

	const handleBlur = useCallback(
		(e: FocusEvent) => {
			const related = e.relatedTarget as HTMLElement | null;
			if (related && listRef.current?.contains(related)) return;

			setInputValue(selected?.name ?? "");
			setQuery("");
			setIsOpen(false);
			setHighlightIndex(-1);
		},
		[selected],
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (disabled) return;
			if (!isOpen && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setIsOpen(true);
					setHighlightIndex((prev) =>
						filtered.length === 0
							? -1
							: prev < filtered.length - 1
								? prev + 1
								: 0,
					);
					break;
				case "ArrowUp":
					e.preventDefault();
					setIsOpen(true);
					setHighlightIndex((prev) =>
						filtered.length === 0
							? -1
							: prev > 0
								? prev - 1
								: filtered.length - 1,
					);
					break;
				case "Enter": {
					if (!isOpen) return;
					e.preventDefault();
					const exact = filtered.find(
						(nt) => nt.name.toLowerCase() === inputValue.trim().toLowerCase(),
					);
					const target = exact ?? filtered[highlightIndex] ?? filtered[0];
					if (target) selectNoteType(target);
					break;
				}
				case "Escape":
					e.preventDefault();
					setInputValue(selected?.name ?? "");
					setQuery("");
					setIsOpen(false);
					setHighlightIndex(-1);
					break;
			}
		},
		[
			disabled,
			isOpen,
			filtered,
			highlightIndex,
			inputValue,
			selectNoteType,
			selected,
		],
	);

	useEffect(() => {
		if (highlightIndex < 0 || !listRef.current) return;
		const item = listRef.current.children[highlightIndex] as HTMLElement;
		item?.scrollIntoView({ block: "nearest" });
	}, [highlightIndex]);

	return (
		<div class="ep:relative ep:min-w-[160px] ep:w-full">
			<SearchInput
				value={inputValue}
				placeholder="Search note types..."
				ariaLabel="Search note types"
				onChange={handleInput}
				onFocus={handleFocus}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				autoComplete="off"
				disabled={disabled}
			/>

			{isOpen && !disabled && (
				<ul
					ref={listRef}
					class={cn(
						"ep:absolute ep:left-0 ep:top-full ep:mt-1 ep:z-50",
						"ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg",
						"ep:max-h-[240px] ep:overflow-y-auto ep:py-1 ep:min-w-full ep:w-[260px] ep:max-w-[90vw]",
					)}
				>
					{filtered.length === 0 ? (
						<li class="ep:px-3 ep:py-2 ep:text-ui-small ep:text-obs-muted">
							No matching note types
						</li>
					) : (
						filtered.map((nt, index) => (
							<li
								key={nt.id}
								tabIndex={-1}
								class={cn(
									"ep:px-3 ep:py-1.5 ep:cursor-pointer ep:text-ui-small ep:flex ep:items-center ep:justify-between ep:gap-3",
									highlightIndex === index
										? "ep:bg-obs-modifier-hover ep:text-obs-normal"
										: "ep:text-obs-muted",
								)}
								onMouseDown={(e) => {
									e.preventDefault();
									selectNoteType(nt);
								}}
								onMouseEnter={() => setHighlightIndex(index)}
							>
								<span class="ep:font-medium ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap">
									{nt.name}
								</span>
								<span class="ep:text-[11px] ep:text-obs-faint ep:shrink-0">
									{nt.type === 1 ? "cloze" : "basic"}
									{!nt.isBuiltin ? " *" : ""}
								</span>
							</li>
						))
					)}
				</ul>
			)}
		</div>
	);
}
