import { useCombobox } from "downshift";
import type { App, TFile } from "obsidian";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
	filterNotesByQuery,
	MAX_DISPLAY_NOTES,
} from "@shared/ui/modals/note-filter.utils";
import { cn } from "@shared/ui/utils/cn";

export interface NotePickerComboboxProps {
	app: App;
	selectedNote: TFile | null;
	onSelect: (note: TFile | null) => void;
	onCreateNew?: () => void;
}

interface NoteItem {
	type: "note";
	file: TFile;
}

interface CreateNewItem {
	type: "create-new";
}

type ComboItem = NoteItem | CreateNewItem;

function itemToString(item: ComboItem | null): string {
	if (!item) return "";
	return item.type === "note" ? item.file.basename : "";
}

export function NotePickerCombobox({
	app,
	selectedNote,
	onSelect,
	onCreateNew,
}: NotePickerComboboxProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [inputValue, setInputValue] = useState(selectedNote?.basename ?? "");

	const allNotes = useMemo(
		() => app.vault.getMarkdownFiles(),
		[app],
	);

	const items: ComboItem[] = useMemo(() => {
		const filtered = filterNotesByQuery(allNotes, inputValue);
		const noteItems: ComboItem[] = filtered
			.slice(0, MAX_DISPLAY_NOTES)
			.map((file) => ({ type: "note" as const, file }));

		if (onCreateNew) {
			noteItems.push({ type: "create-new" });
		}
		return noteItems;
	}, [allNotes, inputValue, onCreateNew]);

	// Sync input when selection changes externally
	useEffect(() => {
		setInputValue(selectedNote?.basename ?? "");
	}, [selectedNote]);

	const handleSelectedItemChange = useCallback(
		(item: ComboItem | null | undefined) => {
			if (!item) return;
			if (item.type === "create-new") {
				onCreateNew?.();
				return;
			}
			onSelect(item.file);
			setInputValue(item.file.basename);
		},
		[onSelect, onCreateNew],
	);

	const {
		isOpen,
		highlightedIndex,
		getMenuProps,
		getInputProps,
		getItemProps,
		getToggleButtonProps,
	} = useCombobox<ComboItem>({
		items,
		inputValue,
		itemToString,
		selectedItem: selectedNote ? { type: "note", file: selectedNote } : null,
		onInputValueChange: ({ inputValue: val }) => {
			setInputValue(val ?? "");
		},
		onSelectedItemChange: ({ selectedItem }) => {
			handleSelectedItemChange(selectedItem);
		},
		stateReducer: (_state, actionAndChanges) => {
			const { type, changes } = actionAndChanges;
			switch (type) {
				case useCombobox.stateChangeTypes.InputBlur:
					// Restore previous selection on blur without choosing
					if (!changes.selectedItem && selectedNote) {
						return {
							...changes,
							inputValue: selectedNote.basename,
							isOpen: false,
						};
					}
					return { ...changes, isOpen: false };
				default:
					return changes;
			}
		},
	});

	const inputProps = getInputProps({ ref: inputRef });

	return (
		<div class="ep:relative">
			<label class="ep:block ep:text-ui-smaller ep:font-medium ep:text-obs-muted ep:mb-1.5">
				Target Note
			</label>
			<div class="ep:relative ep:flex ep:items-center">
				<svg
					class="ep:absolute ep:left-2.5 ep:top-1/2 ep:-translate-y-1/2 ep:text-obs-muted ep:pointer-events-none"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="11" cy="11" r="8" />
					<line x1="21" y1="21" x2="16.65" y2="16.65" />
				</svg>
				<input
					{...inputProps}
					type="text"
					class="ep:w-full ep:py-2 ep:pl-8 ep:pr-8 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted"
					placeholder="Search notes..."
				/>
				<button
					{...getToggleButtonProps()}
					type="button"
					class="ep:absolute ep:right-2 ep:top-1/2 ep:-translate-y-1/2 ep:text-obs-muted ep:bg-transparent ep:border-none ep:cursor-pointer ep:p-0 ep:flex ep:items-center"
					aria-label="toggle menu"
					tabIndex={-1}
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
					>
						<polyline points={isOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
					</svg>
				</button>
			</div>

			<ul
				{...getMenuProps()}
				class={cn(
					"ep:absolute ep:left-0 ep:top-full ep:mt-1 ep:z-50",
					"ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg",
					"ep:max-h-[280px] ep:overflow-y-auto ep:py-1 ep:w-full",
					!(isOpen && items.length > 0) && "ep:hidden",
				)}
			>
				{isOpen &&
					items.map((item, index) => {
						if (item.type === "create-new") {
							return (
								<li
									key="__create_new__"
									{...getItemProps({ item, index })}
									class={cn(
										"ep:px-3 ep:py-2 ep:cursor-pointer ep:text-ui-small ep:flex ep:items-center ep:gap-2 ep:border-t ep:border-obs-border",
										highlightedIndex === index
											? "ep:bg-obs-modifier-hover ep:text-obs-accent"
											: "ep:text-obs-accent",
									)}
								>
									<svg
										width="14"
										height="14"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<line x1="12" y1="5" x2="12" y2="19" />
										<line x1="5" y1="12" x2="19" y2="12" />
									</svg>
									<span class="ep:font-medium">Create new note...</span>
								</li>
							);
						}

						const note = item.file;
						const folderPath = note.parent?.path;

						return (
							<li
								key={note.path}
								{...getItemProps({ item, index })}
								class={cn(
									"ep:px-3 ep:py-1.5 ep:cursor-pointer ep:text-ui-small ep:flex ep:items-center ep:gap-2",
									highlightedIndex === index
										? "ep:bg-obs-modifier-hover ep:text-obs-normal"
										: "ep:text-obs-muted",
								)}
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
		</div>
	);
}
