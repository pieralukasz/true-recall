import { GENERATION_LANGUAGES, type GenerationPreset } from "@true-recall/core";
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
	onLanguageChange?: (id: string, language: string) => void;
	onDelete?: () => void;
	expanded?: boolean;
	onToggleExpanded?: () => void;
}

function LanguageDropdown({
	value,
	onChange,
	compact = false,
}: {
	value: string;
	onChange: (next: string) => void;
	compact?: boolean;
}) {
	return (
		<select
			class={cn("dropdown tr-preset-select", compact && "is-compact")}
			value={value}
			onChange={(e) => onChange((e.target as HTMLSelectElement).value)}
			onClick={(e) => e.stopPropagation()}
			aria-label="Output language"
		>
			{GENERATION_LANGUAGES.map((lang) => (
				<option key={lang.value} value={lang.value}>
					{lang.label}
				</option>
			))}
		</select>
	);
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
	const iconRef = useIcon("chevron-right");
	return (
		<span
			ref={iconRef}
			class={cn("tr-preset-row__chevron", expanded && "is-expanded")}
			aria-hidden="true"
		/>
	);
}

function BadgeRow({ preset }: { preset: GenerationPreset }) {
	return (
		<>
			{preset.requiresPro && (
				<span class="tr-preset-badge tr-preset-badge--pro">Pro</span>
			)}
			{preset.builtin && <span class="tr-preset-badge">Built-in</span>}
			{preset.isDefault && (
				<span class="tr-preset-badge tr-preset-badge--default">Default</span>
			)}
		</>
	);
}

function CompactBadgeRow({ preset }: { preset: GenerationPreset }) {
	return (
		<span class="tr-preset-badges">
			{preset.requiresPro ? (
				<span class="tr-preset-badge tr-preset-badge--pro">Pro</span>
			) : null}
			{preset.isDefault ? (
				<span class="tr-preset-badge tr-preset-badge--default">Default</span>
			) : null}
		</span>
	);
}

function CompactRow({
	preset,
	onLanguageChange,
}: {
	preset: GenerationPreset;
	onLanguageChange?: (id: string, language: string) => void;
}) {
	return (
		<div class="tr-preset-builtin">
			<div class="tr-preset-builtin__main">
				<div class="tr-preset-builtin__title-row">
					<span class="tr-preset-builtin__title">
						{preset.name.replace(/\s*\(Pro\)$/i, "")}
					</span>
					<CompactBadgeRow preset={preset} />
				</div>
				<span class="tr-preset-builtin__description">
					{preset.requiresPro
						? "Included with Pro: managed model, optimized prompt and AI budget."
						: "Available with your own AI provider or True Recall Pro."}
				</span>
			</div>
			{onLanguageChange && (
				<div class="tr-preset-builtin__language">
					<span>Output language</span>
					<LanguageDropdown
						value={preset.languageOverride ?? "auto"}
						onChange={(next) => onLanguageChange(preset.id, next)}
						compact
					/>
				</div>
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
	const lang = preset.languageOverride;
	if (lang && lang !== "auto") {
		const label =
			GENERATION_LANGUAGES.find((l) => l.value === lang)?.label ?? lang;
		parts.push(label);
	}
	if (preset.includeSourceNote) parts.push("+source");
	if (preset.includeRelatedCards) parts.push("+related");
	return parts.join(" • ");
}

export function GenerationPresetEditor({
	preset,
	noteTypes,
	readOnly,
	onChange,
	onLanguageChange,
	onDelete,
	expanded,
	onToggleExpanded,
}: GenerationPresetEditorProps) {
	const isReadOnly = readOnly ?? preset.builtin;
	if (isReadOnly) {
		return <CompactRow preset={preset} onLanguageChange={onLanguageChange} />;
	}

	const canCollapse = onToggleExpanded !== undefined;
	const isExpanded = expanded ?? true;

	const noteType = noteTypes.find((nt) => nt.id === preset.noteTypeId);

	if (canCollapse && !isExpanded) {
		const summary = presetSummary(preset, noteType);
		return (
			<button type="button" onClick={onToggleExpanded} class="tr-preset-row">
				<ChevronIcon expanded={false} />
				<span class="tr-preset-row__name">{preset.name}</span>
				{summary && <span class="tr-preset-row__summary">{summary}</span>}
				<span class="tr-preset-badges">
					<BadgeRow preset={preset} />
				</span>
			</button>
		);
	}

	const patch = (partial: Partial<GenerationPreset>) =>
		onChange?.(preset.id, partial);

	const fieldOptions = noteType?.fields ?? [];

	const sourceNoteId = `gen-source-note-${preset.id}`;
	const relatedCardsId = `gen-related-cards-${preset.id}`;
	const noteTypeId = `gen-note-type-${preset.id}`;

	return (
		<div class="tr-preset-editor">
			<div class="tr-preset-editor__header">
				{canCollapse && (
					<button
						type="button"
						onClick={onToggleExpanded}
						class="tr-preset-editor__collapse"
						aria-label="Collapse"
					>
						<ChevronIcon expanded={true} />
					</button>
				)}
				<span class="tr-preset-editor__title">{preset.name}</span>
				<span class="tr-preset-badges">
					<BadgeRow preset={preset} />
				</span>
			</div>

			<div class="tr-preset-editor__grid">
				<div class="tr-preset-field tr-preset-field--name">
					<span class="tr-preset-field__label">Name</span>
					<TextInput
						value={preset.name}
						onChange={(v) => patch({ name: v })}
						ariaLabel="Preset name"
					/>
				</div>

				<div class="tr-preset-field">
					<label class="tr-preset-field__label" for={noteTypeId}>
						Note type
					</label>
					<select
						id={noteTypeId}
						class="dropdown tr-preset-select"
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
						<span class="tr-preset-field__hint">
							Fields: {noteType.fields.join(", ")}
						</span>
					)}
				</div>

				<div class="tr-preset-field">
					<span class="tr-preset-field__label">Output language</span>
					<LanguageDropdown
						value={preset.languageOverride ?? "auto"}
						onChange={(next) => patch({ languageOverride: next })}
					/>
					<span class="tr-preset-field__hint">
						Overrides language instructions in the prompt.
					</span>
				</div>
			</div>

			<div class="tr-preset-field tr-preset-field--full">
				<span class="tr-preset-field__label">Prompt</span>
				<TextAreaInput
					value={preset.prompt}
					onChange={(v) => patch({ prompt: v })}
					rows={5}
					class="ep:font-mono ep:text-ui-smaller"
					ariaLabel="Generation prompt"
				/>
				<span class="tr-preset-field__hint">
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

			<div class="tr-preset-editor__footer">
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
				<div class="tr-preset-editor__actions">
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
