import { useState } from "preact/hooks";

import { TTS_VOICES } from "@true-recall/core/constants";
import type {
	FieldConfig,
	GenerationPreset,
} from "@true-recall/core/types/generation-preset.types";
import type { NoteType } from "@true-recall/core/types/note.types";

import { PresetFieldEditor } from "./preset-field-editor";

interface PresetEditorProps {
	preset: GenerationPreset;
	noteTypes: NoteType[];
	onSave: (preset: GenerationPreset) => void;
	onCancel: () => void;
}

function buildDefaultFields(noteType: NoteType): Record<string, FieldConfig> {
	return Object.fromEntries(
		noteType.fields.map((f) => [f, { role: "ai-text", instruction: "" }]),
	);
}

export function PresetEditor({
	preset,
	noteTypes,
	onSave,
	onCancel,
}: PresetEditorProps) {
	const [local, setLocal] = useState<GenerationPreset>({ ...preset });

	const selectedNoteType = noteTypes.find((nt) => nt.id === local.noteTypeId);
	const fieldNames = selectedNoteType?.fields ?? [];
	const aiTextFields = fieldNames.filter(
		(f) => local.fields[f]?.role === "ai-text",
	);

	const handleNoteTypeChange = (noteTypeId: string) => {
		const nt = noteTypes.find((n) => n.id === noteTypeId);
		setLocal((prev) => ({
			...prev,
			noteTypeId,
			fields: nt ? buildDefaultFields(nt) : prev.fields,
		}));
	};

	const handleFieldChange = (fieldName: string, config: FieldConfig) => {
		setLocal((prev) => ({
			...prev,
			fields: { ...prev.fields, [fieldName]: config },
		}));
	};

	const handleTtsToggle = (enabled: boolean) => {
		setLocal((prev) => ({
			...prev,
			tts: enabled
				? { field: aiTextFields[0] ?? "", voice: "nova", autoplay: true }
				: null,
		}));
	};

	const handleSave = () => {
		onSave({ ...local, updatedAt: Date.now() });
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-4">
			{/* Name */}
			<div class="ep:flex ep:flex-col ep:gap-1">
				<label for="preset-name" class="ep:text-ui-small ep:font-medium">
					Name
				</label>
				<input
					id="preset-name"
					type="text"
					class="ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:w-full"
					value={local.name}
					onInput={(e) =>
						setLocal((prev) => ({
							...prev,
							name: (e.target as HTMLInputElement).value,
						}))
					}
				/>
			</div>

			{/* Note type */}
			<div class="ep:flex ep:flex-col ep:gap-1">
				<label for="preset-note-type" class="ep:text-ui-small ep:font-medium">
					Note type
				</label>
				<select
					id="preset-note-type"
					class="ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:w-full"
					value={local.noteTypeId}
					onChange={(e) =>
						handleNoteTypeChange((e.target as HTMLSelectElement).value)
					}
				>
					{noteTypes.map((nt) => (
						<option key={nt.id} value={nt.id}>
							{nt.name}
						</option>
					))}
				</select>
			</div>

			{/* Fields */}
			{fieldNames.length > 0 && (
				<div class="ep:flex ep:flex-col ep:gap-1">
					<span class="ep:text-ui-small ep:font-medium">Fields</span>
					<div class="ep:border ep:border-obs-border ep:rounded ep:px-2">
						{fieldNames.map((f) => (
							<PresetFieldEditor
								key={f}
								fieldName={f}
								config={local.fields[f] ?? { role: "ai-text", instruction: "" }}
								allFieldNames={fieldNames}
								onChange={(cfg) => handleFieldChange(f, cfg)}
							/>
						))}
					</div>
				</div>
			)}

			{/* TTS */}
			<div class="ep:flex ep:flex-col ep:gap-2">
				<div class="ep:flex ep:items-center ep:gap-2">
					<input
						type="checkbox"
						id="tts-enabled"
						checked={!!local.tts}
						onChange={(e) =>
							handleTtsToggle((e.target as HTMLInputElement).checked)
						}
					/>
					<label for="tts-enabled" class="ep:text-ui-small ep:font-medium">
						Text-to-speech
					</label>
				</div>
				{local.tts && (
					<div class="ep:flex ep:flex-col ep:gap-2 ep:pl-4">
						<div class="ep:flex ep:gap-2">
							<div class="ep:flex ep:flex-col ep:gap-1 ep:flex-1">
								<label
									for="tts-field"
									class="ep:text-ui-smaller ep:text-obs-muted"
								>
									Field
								</label>
								<select
									id="tts-field"
									class="ep:px-2 ep:py-1 ep:text-ui-smaller ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:w-full"
									value={local.tts.field}
									onChange={(e) =>
										setLocal((prev) => ({
											...prev,
											tts: prev.tts
												? {
														...prev.tts,
														field: (e.target as HTMLSelectElement).value,
													}
												: null,
										}))
									}
								>
									{aiTextFields.map((f) => (
										<option key={f} value={f}>
											{f}
										</option>
									))}
								</select>
							</div>
							<div class="ep:flex ep:flex-col ep:gap-1 ep:flex-1">
								<label
									for="tts-voice"
									class="ep:text-ui-smaller ep:text-obs-muted"
								>
									Voice
								</label>
								<select
									id="tts-voice"
									class="ep:px-2 ep:py-1 ep:text-ui-smaller ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:w-full"
									value={local.tts.voice}
									onChange={(e) =>
										setLocal((prev) => ({
											...prev,
											tts: prev.tts
												? {
														...prev.tts,
														voice: (e.target as HTMLSelectElement).value,
													}
												: null,
										}))
									}
								>
									{TTS_VOICES.map((v) => (
										<option key={v} value={v}>
											{v}
										</option>
									))}
								</select>
							</div>
						</div>
						<div class="ep:flex ep:items-center ep:gap-2">
							<input
								type="checkbox"
								id="tts-autoplay"
								checked={local.tts.autoplay}
								onChange={(e) =>
									setLocal((prev) => ({
										...prev,
										tts: prev.tts
											? {
													...prev.tts,
													autoplay: (e.target as HTMLInputElement).checked,
												}
											: null,
									}))
								}
							/>
							<label for="tts-autoplay" class="ep:text-ui-smaller">
								Autoplay
							</label>
						</div>
					</div>
				)}
			</div>

			{/* Custom prompt */}
			<div class="ep:flex ep:flex-col ep:gap-1">
				<label
					for="preset-custom-prompt"
					class="ep:text-ui-small ep:font-medium"
				>
					Custom prompt
				</label>
				<textarea
					id="preset-custom-prompt"
					class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-smaller ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded ep:font-mono ep:resize-y"
					rows={3}
					placeholder="Extra instructions for AI generation (leave empty for default)"
					value={local.customPrompt ?? ""}
					onInput={(e) =>
						setLocal((prev) => ({
							...prev,
							customPrompt:
								(e.target as HTMLTextAreaElement).value.trim() || undefined,
						}))
					}
				/>
			</div>

			{/* Flags */}
			<div class="ep:flex ep:flex-col ep:gap-2">
				<div class="ep:flex ep:items-center ep:gap-2">
					<input
						type="checkbox"
						id="preset-pinned"
						checked={local.isPinned}
						onChange={(e) =>
							setLocal((prev) => ({
								...prev,
								isPinned: (e.target as HTMLInputElement).checked,
							}))
						}
					/>
					<label for="preset-pinned" class="ep:text-ui-small">
						Pin to toolbar
					</label>
				</div>
				<div class="ep:flex ep:items-center ep:gap-2">
					<input
						type="checkbox"
						id="preset-default"
						checked={local.isDefault}
						onChange={(e) =>
							setLocal((prev) => ({
								...prev,
								isDefault: (e.target as HTMLInputElement).checked,
							}))
						}
					/>
					<label for="preset-default" class="ep:text-ui-small">
						Set as default
					</label>
				</div>
			</div>

			{/* Buttons */}
			<div class="ep:flex ep:gap-2 ep:justify-end">
				<button
					type="button"
					class="ep:px-3 ep:py-1.5 ep:text-ui-small ep:border ep:border-obs-border ep:rounded ep:bg-obs-primary ep:hover:bg-obs-secondary ep:cursor-pointer"
					onClick={onCancel}
				>
					Cancel
				</button>
				<button
					type="button"
					class="ep:px-3 ep:py-1.5 ep:text-ui-small ep:rounded ep:bg-obs-interactive ep:text-obs-on-accent ep:hover:bg-obs-interactive-hover ep:cursor-pointer"
					onClick={handleSave}
				>
					Save
				</button>
			</div>
		</div>
	);
}
