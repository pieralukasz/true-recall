import type { NoteType } from "@true-recall/core/types/note.types";
import { Clickable } from "@true-recall/obsidian/components";
import { cn } from "@true-recall/obsidian/utils/cn";

interface NoteTypeListProps {
	noteTypes: NoteType[];
	selectedId: string | null;
	isCreating: boolean;
	onSelect: (id: string) => void;
	onCreate: () => void;
}

export function NoteTypeList({
	noteTypes,
	selectedId,
	isCreating,
	onSelect,
	onCreate,
}: NoteTypeListProps) {
	const builtins = noteTypes.filter((nt) => nt.isBuiltin);
	const custom = noteTypes.filter((nt) => !nt.isBuiltin);

	return (
		<div class="ep:w-56 ep:border-r ep:border-obs-border ep:flex ep:flex-col ep:shrink-0">
			<div class="ep:flex-1 ep:overflow-y-auto ep:py-1">
				{builtins.map((nt) => (
					<NoteTypeItem
						key={nt.id}
						noteType={nt}
						isSelected={selectedId === nt.id && !isCreating}
						onSelect={onSelect}
					/>
				))}
				{custom.length > 0 && (
					<div class="ep:border-t ep:border-obs-border ep:my-1" />
				)}
				{custom.map((nt) => (
					<NoteTypeItem
						key={nt.id}
						noteType={nt}
						isSelected={selectedId === nt.id && !isCreating}
						onSelect={onSelect}
					/>
				))}
			</div>
			<div class="ep:border-t ep:border-obs-border ep:p-2">
				<Clickable
					class="ep:w-full ep:text-center ep:py-1.5 ep:px-3 ep:rounded-md ep:text-ui-small ep:text-obs-accent ep:hover:bg-obs-accent/10 ep:transition-colors"
					onClick={onCreate}
				>
					+ Add note type
				</Clickable>
			</div>
		</div>
	);
}

function NoteTypeItem({
	noteType,
	isSelected,
	onSelect,
}: {
	noteType: NoteType;
	isSelected: boolean;
	onSelect: (id: string) => void;
}) {
	return (
		<Clickable
			class={cn(
				"ep:w-full ep:flex ep:items-center ep:gap-2 ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded-md ep:mx-1 ep:transition-colors",
				isSelected
					? "ep:bg-obs-accent/10 ep:text-obs-text-normal"
					: "ep:text-obs-muted ep:hover:bg-obs-hover",
			)}
			onClick={() => onSelect(noteType.id)}
		>
			<span class="ep:opacity-50 ep:text-ui-smaller">
				{noteType.isBuiltin ? "🔒" : "📄"}
			</span>
			<span class="ep:truncate ep:flex-1">{noteType.name}</span>
			<span class="ep:text-ui-smaller ep:opacity-40">
				{noteType.templates.length}t
			</span>
		</Clickable>
	);
}
