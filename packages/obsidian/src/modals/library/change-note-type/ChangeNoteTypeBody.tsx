import { useCallback, useMemo, useState } from "preact/hooks";

import type { NoteType } from "@true-recall/core/types/note.types";
import { BUILTIN_IMAGE_OCCLUSION_ID } from "@true-recall/core/types/note.types";

import { Clickable } from "@true-recall/obsidian/components";

import type { ChangeNoteTypeResult } from "../ChangeNoteTypeModal";

interface ChangeNoteTypeBodyProps {
	currentNoteType: NoteType;
	availableNoteTypes: NoteType[];
	onResolve: (result: ChangeNoteTypeResult) => void;
}

export function ChangeNoteTypeBody({
	currentNoteType,
	availableNoteTypes,
	onResolve,
}: ChangeNoteTypeBodyProps) {
	const targetTypes = useMemo(
		() =>
			availableNoteTypes.filter(
				(nt) =>
					nt.id !== currentNoteType.id && nt.id !== BUILTIN_IMAGE_OCCLUSION_ID,
			),
		[availableNoteTypes, currentNoteType.id],
	);

	const [selectedTypeId, setSelectedTypeId] = useState<string>("");
	const selectedType = targetTypes.find((nt) => nt.id === selectedTypeId);

	// Field mapping: newFieldName → oldFieldName (or "" for empty)
	const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

	// Auto-map fields by name when target type changes
	const handleTypeChange = useCallback(
		(typeId: string) => {
			setSelectedTypeId(typeId);
			const target = targetTypes.find((nt) => nt.id === typeId);
			if (!target) {
				setFieldMapping({});
				return;
			}
			const autoMap: Record<string, string> = {};
			for (const field of target.fields) {
				if (currentNoteType.fields.includes(field)) {
					autoMap[field] = field;
				} else {
					autoMap[field] = "";
				}
			}
			setFieldMapping(autoMap);
		},
		[targetTypes, currentNoteType.fields],
	);

	const updateMapping = useCallback((newField: string, oldField: string) => {
		setFieldMapping((prev) => ({ ...prev, [newField]: oldField }));
	}, []);

	const handleConfirm = useCallback(() => {
		if (!selectedTypeId) return;
		onResolve({
			cancelled: false,
			targetNoteTypeId: selectedTypeId,
			fieldMapping,
		});
	}, [selectedTypeId, fieldMapping, onResolve]);

	const handleCancel = useCallback(() => {
		onResolve({ cancelled: true });
	}, [onResolve]);

	// Count how many old fields will be discarded
	const mappedOldFields = new Set(Object.values(fieldMapping).filter(Boolean));
	const discardedFields = currentNoteType.fields.filter(
		(f) => !mappedOldFields.has(f),
	);

	return (
		<div class="ep:space-y-4">
			<div>
				<div class="ep:block ep:text-ui-smaller ep:text-obs-muted ep:mb-1">
					Current type
				</div>
				<div class="ep:text-ui-small ep:font-medium ep:text-obs-normal">
					{currentNoteType.name}
					<span class="ep:text-obs-faint ep:ml-2">
						({currentNoteType.fields.join(", ")})
					</span>
				</div>
			</div>

			<div>
				<div class="ep:block ep:text-ui-smaller ep:text-obs-muted ep:mb-1">
					New type
				</div>
				<select
					class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded"
					value={selectedTypeId}
					onChange={(e) =>
						handleTypeChange((e.target as HTMLSelectElement).value)
					}
				>
					<option value="">Select note type...</option>
					{targetTypes.map((nt) => (
						<option key={nt.id} value={nt.id}>
							{nt.name} ({nt.fields.join(", ")})
						</option>
					))}
				</select>
			</div>

			{selectedType && (
				<div>
					<div class="ep:block ep:text-ui-smaller ep:text-obs-muted ep:mb-2">
						Field mapping
					</div>
					<div class="ep:space-y-2">
						{selectedType.fields.map((newField) => (
							<div key={newField} class="ep:flex ep:items-center ep:gap-2">
								<span class="ep:text-ui-small ep:text-obs-normal ep:w-28 ep:truncate ep:shrink-0">
									{newField}
								</span>
								<span class="ep:text-obs-faint ep:text-ui-smaller">←</span>
								<select
									class="ep:flex-1 ep:px-2 ep:py-1 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded"
									value={fieldMapping[newField] ?? ""}
									onChange={(e) =>
										updateMapping(
											newField,
											(e.target as HTMLSelectElement).value,
										)
									}
								>
									<option value="">(empty)</option>
									{currentNoteType.fields.map((oldField) => (
										<option key={oldField} value={oldField}>
											{oldField}
										</option>
									))}
								</select>
							</div>
						))}
					</div>
				</div>
			)}

			{selectedType && discardedFields.length > 0 && (
				<div class="ep:text-ui-smaller ep:text-obs-warning ep:leading-relaxed">
					Fields not mapped will lose their content:{" "}
					<strong>{discardedFields.join(", ")}</strong>
				</div>
			)}

			<div class="ep:flex ep:justify-end ep:gap-2 ep:pt-2">
				<Clickable
					class="ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded ep:border ep:border-obs-border ep:text-obs-muted hover:ep:bg-obs-modifier-hover"
					onClick={handleCancel}
					stopPropagation={false}
				>
					Cancel
				</Clickable>
				<Clickable
					class="mod-cta ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded"
					onClick={handleConfirm}
					disabled={!selectedTypeId}
					stopPropagation={false}
				>
					Change type
				</Clickable>
			</div>
		</div>
	);
}
