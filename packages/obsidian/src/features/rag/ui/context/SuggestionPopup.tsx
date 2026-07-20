import type { TFile } from "obsidian";
import { useEffect, useRef } from "preact/hooks";

import { useIcon } from "@true-recall/obsidian/preact";
import { cn } from "@true-recall/obsidian/utils/cn";

interface Props {
	suggestions: TFile[];
	highlightIndex: number;
	onSelect: (file: TFile) => void;
	onHover: (index: number) => void;
}

function SuggestionItem({
	note,
	highlighted,
	onSelect,
	onHover,
}: {
	note: TFile;
	highlighted: boolean;
	onSelect: (file: TFile) => void;
	onHover: () => void;
}) {
	const iconRef = useIcon("file-text");
	const folderPath = note.parent?.path;

	return (
		<li
			class={cn(
				"ep:px-2.5 ep:py-1.5 ep:cursor-pointer ep:text-ui-small ep:flex ep:items-center ep:gap-1.5",
				highlighted
					? "ep:bg-obs-modifier-hover ep:text-obs-normal"
					: "ep:text-obs-muted",
			)}
			onMouseDown={(e) => {
				e.preventDefault();
				onSelect(note);
			}}
			onMouseEnter={onHover}
		>
			<span
				ref={iconRef}
				class="ep:shrink-0 ep:flex ep:items-center ep:[&_svg]:w-3.5 ep:[&_svg]:h-3.5"
			/>
			<span class="ep:font-medium ep:truncate ep:min-w-0">{note.basename}</span>
			{folderPath && folderPath !== "/" && (
				<span class="ep:text-[11px] ep:text-obs-faint ep:shrink-0 ep:ml-auto">
					{folderPath}
				</span>
			)}
		</li>
	);
}

export function SuggestionPopup({
	suggestions,
	highlightIndex,
	onSelect,
	onHover,
}: Props) {
	const listRef = useRef<HTMLUListElement>(null);

	useEffect(() => {
		if (highlightIndex < 0 || !listRef.current) return;
		const item = listRef.current.children[highlightIndex] as HTMLElement;
		item?.scrollIntoView({ block: "nearest" });
	}, [highlightIndex]);

	return (
		<ul
			ref={listRef}
			class={cn(
				"ep:absolute ep:bottom-full ep:left-0 ep:mb-1 ep:z-50",
				"ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded-md ep:shadow-lg",
				"ep:max-h-[200px] ep:overflow-y-auto ep:py-1 ep:w-full",
			)}
		>
			{suggestions.map((note, index) => (
				<SuggestionItem
					key={note.path}
					note={note}
					highlighted={highlightIndex === index}
					onSelect={onSelect}
					onHover={() => onHover(index)}
				/>
			))}
		</ul>
	);
}
