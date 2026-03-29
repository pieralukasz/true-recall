import { cn } from "@shared/ui/utils/cn";
import type { TFile } from "obsidian";
import { useEffect, useRef } from "preact/hooks";

interface Props {
	suggestions: TFile[];
	highlightIndex: number;
	onSelect: (file: TFile) => void;
	onHover: (index: number) => void;
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
			{suggestions.map((note, index) => {
				const folderPath = note.parent?.path;
				return (
					<li
						key={note.path}
						class={cn(
							"ep:px-3 ep:py-1.5 ep:cursor-pointer ep:text-ui-small ep:flex ep:items-center ep:gap-2",
							highlightIndex === index
								? "ep:bg-obs-modifier-hover ep:text-obs-normal"
								: "ep:text-obs-muted",
						)}
						onMouseDown={(e) => {
							e.preventDefault();
							onSelect(note);
						}}
						onMouseEnter={() => onHover(index)}
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
	);
}
