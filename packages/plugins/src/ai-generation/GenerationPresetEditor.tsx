import type { GenerationPreset } from "@true-recall/core";
import type { NoteType } from "@true-recall/core/types/note.types";

import {
	ActionButton,
	TextAreaInput,
	TextInput,
} from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/obsidian/utils/cn";

interface GenerationPresetEditorProps {
	preset: GenerationPreset;
	noteTypes: NoteType[];
	readOnly?: boolean;
	onChange?: (id: string, patch: Partial<GenerationPreset>) => void;
	onFork?: () => void;
	onDelete?: () => void;
	expanded?: boolean;
	onToggleExpanded?: () => void;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
	const iconRef = useIcon("chevron-right");
	return (
		<span
			ref={iconRef}
			class={cn(
				"ep:w-4 ep:h-4 ep:text-obs-muted ep:transition-transform ep:duration-200 ep:flex-shrink-0",
				expanded && "ep:rotate-90",
			)}
		/>
	);
}

function BadgeRow({ preset }: { preset: GenerationPreset }) {
	return (
		<>
			{preset.requiresPro && (
				<span class="ep:text-ui-smallest ep:font-semibold ep:px-1.5 ep:py-0.5 ep:rounded ep:bg-obs-accent ep:text-obs-on-accent ep:uppercase">
					Pro
				</span>
			)}
			{preset.builtin && (
				<span class="ep:text-ui-smallest ep:font-semibold ep:px-1.5 ep:py-0.5 ep:rounded ep:bg-obs-border ep:text-obs-muted ep:uppercase">
					Built-in
				</span>
			)}
			{preset.isDefault && (
				<span class="ep:text-ui-smallest ep:font-semibold ep:px-1.5 ep:py-0.5 ep:rounded ep:bg-obs-modifier-success ep:text-obs-on-accent ep:uppercase">
					Default
				</span>
			)}
		</>
	);
}

function CompactRow({
	preset,
	onFork,
}: {
	preset: GenerationPreset;
	onFork?: () => void;
}) {
	return (
		<div class="ep:flex ep:items-center ep:gap-2 ep:p-2 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary">
			<span class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:flex-1 ep:truncate">
				{preset.name}
			</span>
			<BadgeRow preset={preset} />
			{onFork && (
				<ActionButton
					label="Fork to edit"
					variant="outline"
					size="sm"
					onClick={onFork}
				/>
			)}
		</div>
	);
}

function presetSummary(
	preset: GenerationPreset,
	noteType: NoteType | undefined,
): string {
	const parts: string[] = [];
	if (noteType) parts.push(noteType.name);
	if (preset.includeSourceNote) parts.push("+source");
	if (preset.includeRelatedCards) parts.push("+related");
	return parts.join(" • ");
}

export function GenerationPresetEditor({
	preset,
	noteTypes,
	readOnly,
	onChange,
	onFork,
	onDelete,
	expanded,
	onToggleExpanded,
}: GenerationPresetEditorProps) {
	const isReadOnly = readOnly ?? preset.builtin;
	if (isReadOnly) {
		return <CompactRow preset={preset} onFork={onFork} />;
	}

	const canCollapse = onToggleExpanded !== undefined;
	const isExpanded = expanded ?? true;

	const noteType = noteTypes.find((nt) => nt.id === preset.noteTypeId);

	if (canCollapse && !isExpanded) {
		const summary = presetSummary(preset, noteType);
		return (
			<button
				type="button"
				onClick={onToggleExpanded}
				class="ep:flex ep:items-center ep:gap-2 ep:p-2 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:w-full ep:text-left ep:cursor-pointer ep:hover:bg-obs-modifier-hover ep:transition-colors"
			>
				<ChevronIcon expanded={false} />
				<span class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:truncate">
					{preset.name}
				</span>
				{summary && (
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:truncate ep:flex-1">
						{summary}
					</span>
				)}
				<BadgeRow preset={preset} />
			</button>
		);
	}

	const patch = (partial: Partial<GenerationPreset>) =>
		onChange?.(preset.id, partial);

	const fieldOptions = noteType?.fields ?? [];

	const sourceNoteId = `gen-source-note-${preset.id}`;
	const relatedCardsId = `gen-related-cards-${preset.id}`;

	return (
		<div class="ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary">
			<div class="ep:flex ep:items-center ep:gap-2">
				{canCollapse && (
					<button
						type="button"
						onClick={onToggleExpanded}
						class="ep:flex ep:items-center ep:cursor-pointer ep:bg-transparent ep:border-0 ep:p-0"
						aria-label="Collapse"
					>
						<ChevronIcon expanded={true} />
					</button>
				)}
				<span class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:flex-1 ep:truncate">
					{preset.name}
				</span>
				<BadgeRow preset={preset} />
			</div>

			<div class="ep:flex ep:flex-col ep:gap-1">
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
					Name
				</span>
				<TextInput value={preset.name} onChange={(v) => patch({ name: v })} />
			</div>

			<div class="ep:flex ep:flex-col ep:gap-1">
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
					Note type
				</span>
				<select
					class="dropdown"
					value={preset.noteTypeId}
					onChange={(e) => {
						const nextId = (e.target as HTMLSelectElement).value;
						patch({ noteTypeId: nextId });
					}}
				>
					{noteTypes.map((nt) => (
						<option key={nt.id} value={nt.id}>
							{nt.name}
						</option>
					))}
				</select>
				{noteType && (
					<span class="ep:text-ui-smaller ep:text-obs-muted">
						Fields: {noteType.fields.join(", ")}
					</span>
				)}
			</div>

			<div class="ep:flex ep:flex-col ep:gap-1">
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
					Prompt
				</span>
				<TextAreaInput
					value={preset.prompt}
					onChange={(v) => patch({ prompt: v })}
					rows={6}
					class="ep:font-mono ep:text-ui-smaller"
				/>
				<span class="ep:text-ui-smaller ep:text-obs-muted">
					Describe what cards to generate. The system appends "Fields to fill:{" "}
					{fieldOptions.join(", ")}" and a JSON format spec.
				</span>
			</div>

			<div class="ep:flex ep:flex-col ep:gap-2 ep:p-2 ep:border ep:border-obs-border ep:rounded">
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
					Context (opt-in)
				</span>
				<label
					for={sourceNoteId}
					class="ep:flex ep:items-start ep:gap-2 ep:text-ui-small ep:cursor-pointer"
				>
					<input
						id={sourceNoteId}
						type="checkbox"
						checked={!!preset.includeSourceNote}
						onChange={(e) =>
							patch({
								includeSourceNote: (e.target as HTMLInputElement).checked,
							})
						}
					/>
					<span class="ep:flex ep:flex-col">
						<span>Include source note content</span>
						<span class="ep:text-ui-smaller ep:text-obs-muted">
							Increases cost and latency — improves quality
						</span>
					</span>
				</label>
				<label
					for={relatedCardsId}
					class="ep:flex ep:items-start ep:gap-2 ep:text-ui-small ep:cursor-pointer"
				>
					<input
						id={relatedCardsId}
						type="checkbox"
						checked={!!preset.includeRelatedCards}
						onChange={(e) =>
							patch({
								includeRelatedCards: (e.target as HTMLInputElement).checked,
							})
						}
					/>
					<span class="ep:flex ep:flex-col">
						<span>Include related flashcards from the same source</span>
						<span class="ep:text-ui-smaller ep:text-obs-muted">
							Increases cost and latency — improves quality
						</span>
					</span>
				</label>
			</div>

			<div class="ep:flex ep:items-center ep:justify-between ep:gap-3 ep:pt-1">
				<label class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small">
					<input
						type="checkbox"
						checked={preset.isDefault}
						onChange={(e) =>
							patch({ isDefault: (e.target as HTMLInputElement).checked })
						}
					/>
					<span>Make default</span>
				</label>
				<div class="ep:flex ep:gap-2">
					{onDelete && (
						<ActionButton
							label="Delete"
							variant="danger"
							size="sm"
							onClick={onDelete}
						/>
					)}
				</div>
			</div>
		</div>
	);
}
