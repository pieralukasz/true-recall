import { Clickable } from "@shared/ui/components";
import { useIcon } from "@shared/ui/preact";
import type {
	CardContextItem,
	ContextItem,
	NoteContextItem,
} from "./context.types";

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
			class={`ep:flex ep:items-center ep:gap-1 ep:text-[11px] ep:pl-1.5 ep:pr-1 ep:py-0.5 ep:rounded-md ep:max-w-[180px] ep:text-obs-muted ep:transition-colors ${
				item.auto
					? "ep:border ep:border-dashed ep:border-obs-border ep:bg-transparent"
					: "ep:bg-obs-modifier-hover"
			}`}
		>
			<div
				ref={iconRef}
				class="ep:w-3 ep:h-3 ep:shrink-0 [&_svg]:ep:w-3 [&_svg]:ep:h-3"
			/>
			<span class="ep:truncate ep:leading-tight">{label}</span>
			<Clickable
				class="ep:w-3.5 ep:h-3.5 ep:shrink-0 ep:flex ep:items-center ep:justify-center ep:rounded-sm ep:text-obs-faint ep:hover:text-obs-normal ep:hover:bg-obs-modifier-hover ep:transition-colors [&_svg]:ep:w-2.5 [&_svg]:ep:h-2.5"
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
