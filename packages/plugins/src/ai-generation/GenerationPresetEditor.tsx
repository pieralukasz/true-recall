import type {
	GenerationPreset,
	PresetImageConfig,
	PresetTTSConfig,
} from "@true-recall/core";
import { TTS_VOICES } from "@true-recall/core/constants";
import type { NoteType } from "@true-recall/core/types/note.types";

import {
	ActionButton,
	TextAreaInput,
	TextInput,
} from "@true-recall/obsidian/components";

interface GenerationPresetEditorProps {
	preset: GenerationPreset;
	noteTypes: NoteType[];
	readOnly?: boolean;
	onChange?: (next: GenerationPreset) => void;
	onFork?: () => void;
	onDelete?: () => void;
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

export function GenerationPresetEditor({
	preset,
	noteTypes,
	readOnly,
	onChange,
	onFork,
	onDelete,
}: GenerationPresetEditorProps) {
	const isReadOnly = readOnly ?? preset.builtin;
	if (isReadOnly) {
		return <CompactRow preset={preset} onFork={onFork} />;
	}

	const patch = (partial: Partial<GenerationPreset>) =>
		onChange?.({ ...preset, ...partial, updatedAt: Date.now() });

	const noteType = noteTypes.find((nt) => nt.id === preset.noteTypeId);
	const fieldOptions = noteType?.fields ?? [];

	const ttsEnabled = preset.tts !== null;
	const imageEnabled = preset.image !== null;

	const patchTTS = (partial: Partial<PresetTTSConfig>) => {
		const current: PresetTTSConfig = preset.tts ?? {
			field: fieldOptions[0] ?? "",
			voice: TTS_VOICES[0],
			autoplay: false,
		};
		patch({ tts: { ...current, ...partial } });
	};

	const patchImage = (partial: Partial<PresetImageConfig>) => {
		const current: PresetImageConfig = preset.image ?? {
			targetField: fieldOptions[1] ?? fieldOptions[0] ?? "",
			sourceField: fieldOptions[0] ?? "",
		};
		patch({ image: { ...current, ...partial } });
	};

	return (
		<div class="ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary">
			<div class="ep:flex ep:items-center ep:gap-2">
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
						const nextNoteType = noteTypes.find((nt) => nt.id === nextId);
						const nextFields = new Set(nextNoteType?.fields ?? []);
						// Drop TTS/image configs that reference fields the new note
						// type does not have — otherwise generation throws at runtime.
						const nextTts =
							preset.tts && nextFields.has(preset.tts.field)
								? preset.tts
								: null;
						const nextImage =
							preset.image &&
							nextFields.has(preset.image.targetField) &&
							nextFields.has(preset.image.sourceField)
								? preset.image
								: null;
						patch({ noteTypeId: nextId, tts: nextTts, image: nextImage });
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

			<details class="ep:border ep:border-obs-border ep:rounded ep:p-2">
				<summary class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium ep:cursor-pointer">
					Audio (TTS) {ttsEnabled && "— enabled"}
				</summary>
				<div class="ep:flex ep:flex-col ep:gap-2 ep:mt-2">
					<label class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small">
						<input
							type="checkbox"
							checked={ttsEnabled}
							onChange={(e) => {
								const on = (e.target as HTMLInputElement).checked;
								if (on) patchTTS({});
								else patch({ tts: null });
							}}
						/>
						<span>Generate audio for a field</span>
					</label>
					{ttsEnabled && preset.tts && (
						<>
							<label class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small">
								<span class="ep:w-16">Field</span>
								<select
									class="dropdown"
									value={preset.tts.field}
									onChange={(e) =>
										patchTTS({ field: (e.target as HTMLSelectElement).value })
									}
								>
									{fieldOptions.map((f) => (
										<option key={f} value={f}>
											{f}
										</option>
									))}
								</select>
							</label>
							<label class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small">
								<span class="ep:w-16">Voice</span>
								<select
									class="dropdown"
									value={preset.tts.voice}
									onChange={(e) =>
										patchTTS({ voice: (e.target as HTMLSelectElement).value })
									}
								>
									{TTS_VOICES.map((v) => (
										<option key={v} value={v}>
											{v}
										</option>
									))}
								</select>
							</label>
							<label class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small">
								<input
									type="checkbox"
									checked={preset.tts.autoplay}
									onChange={(e) =>
										patchTTS({
											autoplay: (e.target as HTMLInputElement).checked,
										})
									}
								/>
								<span>Autoplay during review</span>
							</label>
						</>
					)}
				</div>
			</details>

			<details class="ep:border ep:border-obs-border ep:rounded ep:p-2">
				<summary class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium ep:cursor-pointer">
					Image {imageEnabled && "— enabled"}
				</summary>
				<div class="ep:flex ep:flex-col ep:gap-2 ep:mt-2">
					<label class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small">
						<input
							type="checkbox"
							checked={imageEnabled}
							onChange={(e) => {
								const on = (e.target as HTMLInputElement).checked;
								if (on) patchImage({});
								else patch({ image: null });
							}}
						/>
						<span>Generate image for a field</span>
					</label>
					{imageEnabled && preset.image && (
						<>
							<label class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small">
								<span class="ep:w-28">Target field</span>
								<select
									class="dropdown"
									value={preset.image.targetField}
									onChange={(e) =>
										patchImage({
											targetField: (e.target as HTMLSelectElement).value,
										})
									}
								>
									{fieldOptions.map((f) => (
										<option key={f} value={f}>
											{f}
										</option>
									))}
								</select>
							</label>
							<label class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small">
								<span class="ep:w-28">Source text</span>
								<select
									class="dropdown"
									value={preset.image.sourceField}
									onChange={(e) =>
										patchImage({
											sourceField: (e.target as HTMLSelectElement).value,
										})
									}
								>
									{fieldOptions.map((f) => (
										<option key={f} value={f}>
											{f}
										</option>
									))}
								</select>
							</label>
							<div class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small">
								<span class="ep:w-28">Style (opt.)</span>
								<TextInput
									value={preset.image.style ?? ""}
									onChange={(v) => patchImage({ style: v || undefined })}
								/>
							</div>
						</>
					)}
				</div>
			</details>

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
