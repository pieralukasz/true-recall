import { useCombobox } from "downshift";
import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { cn } from "@shared/ui/utils/cn";
import {
	getTokenAtCursor,
	getTokenContext,
	replaceTokenAtCursor,
} from "@shared/ui/helpers/search-suggestions";
import type {
	SearchSuggestion,
	SuggestionCategory,
	SuggestionProvider,
} from "@shared/ui/helpers/search-suggestions.types";

export interface SearchComboboxProps {
	value: string;
	placeholder: string;
	onChange: (query: string) => void;
	getSuggestions: SuggestionProvider;
	autoFocus?: boolean;
	class?: string;
	showSearchIcon?: boolean;
}

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
	keyword: "Filters",
	state: "States",
	property: "Properties",
	note: "Notes",
	project: "Projects",
	preset: "Presets",
	type: "Card Types",
	via: "Created Via",
	date: "Date Filters",
};

interface SuggestionGroup {
	category: SuggestionCategory;
	label: string;
	items: (SearchSuggestion & { globalIndex: number })[];
}

function groupSuggestions(items: SearchSuggestion[]): SuggestionGroup[] {
	const groups = new Map<SuggestionCategory, SuggestionGroup>();
	let globalIndex = 0;

	for (const item of items) {
		let group = groups.get(item.category);
		if (!group) {
			group = {
				category: item.category,
				label: CATEGORY_LABELS[item.category],
				items: [],
			};
			groups.set(item.category, group);
		}
		group.items.push({ ...item, globalIndex });
		globalIndex++;
	}

	return Array.from(groups.values());
}

export function SearchCombobox({
	value,
	placeholder,
	onChange,
	getSuggestions,
	autoFocus = false,
	class: cls,
	showSearchIcon = false,
}: SearchComboboxProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const cursorPos = useSignal(0);

	const suggestions = useMemo(
		() => getSuggestions(value, cursorPos.value),
		[value, cursorPos.value, getSuggestions],
	);

	const grouped = useMemo(() => groupSuggestions(suggestions), [suggestions]);

	const trackCursor = useCallback(() => {
		const pos = inputRef.current?.selectionStart ?? 0;
		cursorPos.value = pos;
	}, []);

	const {
		isOpen,
		highlightedIndex,
		getMenuProps,
		getInputProps,
		getItemProps,
	} = useCombobox({
		items: suggestions,
		inputValue: value,
		itemToString: (item: SearchSuggestion | null) => item?.label ?? "",
		onInputValueChange: ({ inputValue }: { inputValue: string }) => {
			onChange(inputValue ?? "");
		},
		stateReducer: (
			state: { inputValue: string },
			actionAndChanges: { type: string; changes: Record<string, unknown> },
		) => {
			const { type, changes } = actionAndChanges;
			switch (type) {
				case useCombobox.stateChangeTypes.InputKeyDownEnter:
				case useCombobox.stateChangeTypes.ItemClick: {
					const selectedItem = changes.selectedItem as
						| SearchSuggestion
						| undefined;
					if (!selectedItem) return changes;

					const { text, cursor } = replaceTokenAtCursor(
						state.inputValue,
						cursorPos.value,
						selectedItem.insertText,
					);

					// Schedule cursor restore after Preact re-renders
					requestAnimationFrame(() => {
						const el = inputRef.current;
						if (el) {
							el.setSelectionRange(cursor, cursor);
							cursorPos.value = cursor;
						}
					});

					onChange(text);

					return {
						...changes,
						inputValue: text,
						selectedItem: null,
						isOpen: false,
					};
				}
				case useCombobox.stateChangeTypes.InputBlur:
					return { ...changes, isOpen: false };
				default:
					return changes;
			}
		},
	});

	useEffect(() => {
		if (!autoFocus) return;
		const id = setTimeout(() => inputRef.current?.focus(), 50);
		return () => clearTimeout(id);
	}, [autoFocus]);

	const inputProps = getInputProps({
		ref: inputRef,
		onKeyUp: trackCursor,
		onClick: trackCursor,
	});

	return (
		<div class={cn("ep:relative", cls)}>
			<div class="ep:relative">
				{showSearchIcon && (
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
				)}
				<input
					{...inputProps}
					type="text"
					class={cn(
						"ep:w-full ep:py-1.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:focus:outline-none ep:focus:border-obs-interactive ep:placeholder:text-obs-muted",
						showSearchIcon && "ep:pl-8",
					)}
					placeholder={placeholder}
				/>
			</div>

			<ul
				{...getMenuProps()}
				class={cn(
					"ep:absolute ep:left-0 ep:top-full ep:mt-1 ep:z-50",
					"ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg",
					"ep:max-h-[300px] ep:overflow-y-auto ep:py-1 ep:min-w-full",
					!(isOpen && suggestions.length > 0) && "ep:hidden",
				)}
			>
				{isOpen &&
					grouped.map((group) => (
						<li key={group.category}>
							<span class="ep:block ep:px-3 ep:py-1 ep:text-[10px] ep:uppercase ep:tracking-wider ep:text-obs-faint ep:select-none">
								{group.label}
							</span>
							<ul>
								{group.items.map((item) => (
									<li
										key={item.id}
										{...getItemProps({
											item,
											index: item.globalIndex,
										})}
										class={cn(
											"ep:px-3 ep:py-1.5 ep:cursor-pointer ep:text-ui-small ep:flex ep:items-center ep:gap-2",
											highlightedIndex ===
												item.globalIndex
												? "ep:bg-obs-modifier-hover ep:text-obs-normal"
												: "ep:text-obs-muted",
										)}
									>
										<span class="ep:font-medium">
											{item.label}
										</span>
										{item.description && (
											<span class="ep:text-obs-faint ep:text-[11px]">
												{item.description}
											</span>
										)}
									</li>
								))}
							</ul>
						</li>
					))}
			</ul>
		</div>
	);
}
