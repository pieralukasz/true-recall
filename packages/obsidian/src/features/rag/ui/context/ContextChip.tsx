import type {
	CardContextItem,
	ContextItem,
	NoteContextItem,
} from "@true-recall/core/rag/context/context.types";

import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact";

interface Props {
	item: ContextItem;
	onDismiss: () => void;
}

export function ContextChip({ item, onDismiss }: Props) {
	const isNote = item.kind.includes("note");
	const iconRef = useIcon(isNote ? "file-text" : "brain");
	const closeRef = useIcon("x");

	const label = isNote
		? (item as NoteContextItem).basename
		: (item as CardContextItem).question;

	return (
		<div
			class={`ep:inline-flex ep:items-center ep:gap-1 ep:text-xs ep:pl-1.5 ep:pr-0.5 ep:py-0.5 ep:rounded-md ep:max-w-[220px] ep:text-obs-muted ep:transition-colors ${
				item.auto
					? "ep:border ep:border-dashed ep:border-obs-border ep:bg-transparent"
					: "ep:bg-obs-modifier-hover"
			}`}
		>
			<span
				ref={iconRef}
				class="ep:shrink-0 ep:flex ep:items-center [&_svg]:ep:w-3 [&_svg]:ep:h-3"
			/>
			<span class="ep:truncate ep:leading-none">{label}</span>
			<Clickable
				class="ep:w-5 ep:h-5 ep:shrink-0 ep:flex ep:items-center ep:justify-center ep:rounded-sm ep:text-obs-faint ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover ep:transition-colors [&_svg]:ep:w-3 [&_svg]:ep:h-3"
				onClick={(e: MouseEvent) => {
					e.stopPropagation();
					onDismiss();
				}}
				aria-label="Remove context"
			>
				<span ref={closeRef} />
			</Clickable>
		</div>
	);
}
