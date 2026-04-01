import type { NoteTypeMapping } from "@true-recall/core/types";
import type { NoteType } from "@true-recall/core/types/note.types";
import { ModalFooter } from "@true-recall/obsidian/components";
import { useState } from "preact/hooks";

const AUTO_CREATE = "auto";

export interface MappingPhaseProps {
	suggestions: NoteTypeMapping[];
	existingNoteTypes: NoteType[];
	onImport: (mappings: Map<number, string>) => void;
	onCancel: () => void;
}

export function MappingPhase({
	suggestions,
	existingNoteTypes,
	onImport,
	onCancel,
}: MappingPhaseProps) {
	const [mappings, setMappings] = useState<Map<number, string>>(() => {
		const initial = new Map<number, string>();
		for (const s of suggestions) {
			initial.set(s.ankiModelId, s.suggestedNoteTypeId ?? AUTO_CREATE);
		}
		return initial;
	});

	function handleChange(modelId: number, noteTypeId: string) {
		setMappings((prev) => {
			const next = new Map(prev);
			next.set(modelId, noteTypeId);
			return next;
		});
	}

	function handleImport() {
		onImport(mappings);
	}

	return (
		<>
			<div class="ep:text-ui-small ep:font-medium ep:mb-3">
				Map Anki note types
			</div>

			<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[300px] ep:overflow-y-auto">
				{suggestions.map((s) => (
					<MappingRow
						key={s.ankiModelId}
						suggestion={s}
						existingNoteTypes={existingNoteTypes}
						selectedId={mappings.get(s.ankiModelId) ?? AUTO_CREATE}
						onChange={(id) => handleChange(s.ankiModelId, id)}
					/>
				))}
			</div>

			<ModalFooter
				onCancel={onCancel}
				onConfirm={handleImport}
				confirmLabel="Import"
			/>
		</>
	);
}

function MappingRow({
	suggestion,
	existingNoteTypes,
	selectedId,
	onChange,
}: {
	suggestion: NoteTypeMapping;
	existingNoteTypes: NoteType[];
	selectedId: string;
	onChange: (noteTypeId: string) => void;
}) {
	const typeLabel = suggestion.ankiType === 1 ? "Cloze" : "Basic";

	// Filter to types with compatible field count
	const compatible = existingNoteTypes.filter(
		(nt) => nt.fields.length >= suggestion.ankiFields.length,
	);

	return (
		<div class="ep:p-3 ep:border-b ep:border-obs-border last:ep:border-b-0">
			<div class="ep:flex ep:items-center ep:justify-between ep:mb-1">
				<div class="ep:text-ui-small ep:font-medium">
					{suggestion.ankiModelName}
				</div>
				<div class="ep:flex ep:items-center ep:gap-2">
					<span class="ep:text-ui-smaller ep:text-obs-muted">{typeLabel}</span>
					{suggestion.cardCount > 0 && (
						<span class="ep:text-ui-smaller ep:text-obs-muted">
							{suggestion.cardCount} cards
						</span>
					)}
				</div>
			</div>

			<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-2">
				Fields: {suggestion.ankiFields.join(", ")}
			</div>

			<select
				class="ep:w-full ep:text-ui-small ep:bg-obs-primary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded ep:px-2 ep:py-1"
				value={selectedId}
				onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
			>
				<option value={AUTO_CREATE}>Auto-create new type</option>
				{compatible.map((nt) => (
					<option key={nt.id} value={nt.id}>
						{nt.name}
						{nt.isBuiltin ? " (builtin)" : ""}
					</option>
				))}
			</select>
		</div>
	);
}
