import type { ModelMapping, NoteTypeMapping } from "@true-recall/core/types";
import type { NoteType } from "@true-recall/core/types/note.types";
import { ModalFooter } from "@true-recall/obsidian/components";
import { useState } from "preact/hooks";

const AUTO_CREATE = "auto";
const SKIP_FIELD = "__skip__";

export interface MappingPhaseProps {
	suggestions: NoteTypeMapping[];
	existingNoteTypes: NoteType[];
	onImport: (mappings: Map<number, ModelMapping>) => void;
	onCancel: () => void;
}

export function MappingPhase({
	suggestions,
	existingNoteTypes,
	onImport,
	onCancel,
}: MappingPhaseProps) {
	const [mappings, setMappings] = useState<Map<number, ModelMapping>>(() => {
		const initial = new Map<number, ModelMapping>();
		for (const s of suggestions) {
			initial.set(s.ankiModelId, {
				noteTypeId: s.suggestedNoteTypeId ?? AUTO_CREATE,
			});
		}
		return initial;
	});

	function handleTypeChange(modelId: number, noteTypeId: string) {
		setMappings((prev) => {
			const next = new Map(prev);
			next.set(modelId, { noteTypeId });
			return next;
		});
	}

	function handleFieldChange(
		modelId: number,
		ankiField: string,
		targetField: string,
	) {
		setMappings((prev) => {
			const next = new Map(prev);
			const existing = next.get(modelId);
			if (!existing) return next;

			const fieldMapping = new Map(existing.fieldMapping ?? []);
			if (targetField === SKIP_FIELD) {
				fieldMapping.delete(ankiField);
			} else {
				fieldMapping.set(ankiField, targetField);
			}
			next.set(modelId, { ...existing, fieldMapping });
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

			<div class="ep:border ep:border-obs-border ep:rounded-md ep:max-h-[400px] ep:overflow-y-auto">
				{suggestions.map((s) => {
					const mapping = mappings.get(s.ankiModelId);
					const selectedType = existingNoteTypes.find(
						(nt) => nt.id === mapping?.noteTypeId,
					);

					return (
						<MappingRow
							key={s.ankiModelId}
							suggestion={s}
							existingNoteTypes={existingNoteTypes}
							selectedId={mapping?.noteTypeId ?? AUTO_CREATE}
							selectedType={selectedType}
							fieldMapping={mapping?.fieldMapping}
							onTypeChange={(id) => handleTypeChange(s.ankiModelId, id)}
							onFieldChange={(ankiF, trF) =>
								handleFieldChange(s.ankiModelId, ankiF, trF)
							}
						/>
					);
				})}
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
	selectedType,
	fieldMapping,
	onTypeChange,
	onFieldChange,
}: {
	suggestion: NoteTypeMapping;
	existingNoteTypes: NoteType[];
	selectedId: string;
	selectedType: NoteType | undefined;
	fieldMapping: Map<string, string> | undefined;
	onTypeChange: (noteTypeId: string) => void;
	onFieldChange: (ankiField: string, targetField: string) => void;
}) {
	const typeLabel = suggestion.ankiType === 1 ? "Cloze" : "Basic";
	const showFieldMapping = selectedId !== AUTO_CREATE && selectedType;

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
				onChange={(e) => onTypeChange((e.target as HTMLSelectElement).value)}
			>
				<option value={AUTO_CREATE}>Auto-create new type</option>
				{existingNoteTypes.map((nt) => (
					<option key={nt.id} value={nt.id}>
						{nt.name}
						{nt.isBuiltin ? " (builtin)" : ""}
					</option>
				))}
			</select>

			{showFieldMapping && (
				<div class="ep:mt-2 ep:pl-2 ep:border-l-2 ep:border-obs-border">
					<div class="ep:text-ui-smaller ep:text-obs-muted ep:mb-1">
						Field mapping:
					</div>
					{suggestion.ankiFields.map((ankiField) => {
						const currentTarget =
							fieldMapping?.get(ankiField) ??
							autoMatchField(ankiField, selectedType.fields);

						return (
							<div
								key={ankiField}
								class="ep:flex ep:items-center ep:gap-2 ep:py-0.5"
							>
								<span class="ep:text-ui-smaller ep:w-24 ep:truncate">
									{ankiField}
								</span>
								<span class="ep:text-ui-smaller ep:text-obs-muted">→</span>
								<select
									class="ep:flex-1 ep:text-ui-smaller ep:bg-obs-primary ep:text-obs-normal ep:border ep:border-obs-border ep:rounded ep:px-1 ep:py-0.5"
									value={currentTarget}
									onChange={(e) =>
										onFieldChange(
											ankiField,
											(e.target as HTMLSelectElement).value,
										)
									}
								>
									<option value={SKIP_FIELD}>(skip)</option>
									{selectedType.fields.map((f) => (
										<option key={f} value={f}>
											{f}
										</option>
									))}
								</select>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function autoMatchField(ankiField: string, targetFields: string[]): string {
	// Exact match
	const exact = targetFields.find((f) => f === ankiField);
	if (exact) return exact;

	// Case-insensitive match
	const lower = ankiField.toLowerCase();
	const caseMatch = targetFields.find((f) => f.toLowerCase() === lower);
	if (caseMatch) return caseMatch;

	return SKIP_FIELD;
}
