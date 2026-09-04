import type {
	CardAIExecutor,
	CardAIFieldScope,
	CardAIPreset,
	CardAIPresetMode,
} from "@true-recall/core";

import {
	ActionButton,
	SelectInput,
	TextAreaInput,
	TextInput,
	ToggleInput,
} from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { cn } from "@true-recall/obsidian/utils/cn";

import { resolveCardAIPolicy } from "./card-ai/card-ai-policy";

const MODE_OPTIONS = [
	{ value: "edit", label: "Edit current card only" },
	{ value: "split", label: "Replace current card and split" },
	{ value: "spawn", label: "Keep current card and add new cards" },
];

const FIELD_SCOPE_OPTIONS = [
	{ value: "all", label: "All fields" },
	{ value: "question", label: "Question only" },
	{ value: "answer", label: "Answer only" },
	{ value: "empty-answer", label: "Empty answer only" },
];

const EXECUTOR_OPTIONS = [
	{ value: "ai", label: "AI" },
	{ value: "remove-backlinks", label: "Remove backlinks locally" },
	{
		value: "shorten-attachment-paths",
		label: "Shorten attachment paths locally",
	},
];

interface CardAIPresetEditorProps {
	preset: CardAIPreset;
	readOnly?: boolean;
	onChange?: (id: string, patch: Partial<CardAIPreset>) => void;
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
			class={cn("tr-preset-row__chevron", expanded && "is-expanded")}
		/>
	);
}

function BadgeRow({ preset }: { preset: CardAIPreset }) {
	return (
		<>
			{preset.requiresPro && (
				<span class="tr-preset-badge tr-preset-badge--pro">Pro</span>
			)}
			{preset.builtin && <span class="tr-preset-badge">Built-in</span>}
			{preset.disabled && <span class="tr-preset-badge">Disabled</span>}
		</>
	);
}

function CompactPresetRow({
	preset,
	onFork,
}: {
	preset: CardAIPreset;
	onFork?: () => void;
}) {
	return (
		<div class="tr-preset-builtin">
			<div class="tr-preset-builtin__main">
				<div class="tr-preset-builtin__title-row">
					<span class="tr-preset-builtin__title">{preset.name}</span>
					<span class="tr-preset-badges">
						<BadgeRow preset={preset} />
					</span>
				</div>
				<span class="tr-preset-builtin__description">
					Ready-made workflow included with the plugin. Fork it to customize the
					prompt and behavior.
				</span>
			</div>
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

function presetSummary(preset: CardAIPreset): string {
	const parts: string[] = [];
	if (preset.autoApply) parts.push("auto-edits");
	if (preset.autoApplyNewCards) parts.push("auto-spawn");
	if (preset.includeSourceNote) parts.push("+source");
	if (preset.includeRelatedCards) parts.push("+related");
	return parts.join(" • ");
}

export function CardAIPresetEditor({
	preset,
	readOnly,
	onChange,
	onFork,
	onDelete,
	expanded,
	onToggleExpanded,
}: CardAIPresetEditorProps) {
	const isReadOnly = readOnly ?? preset.builtin;

	if (isReadOnly) {
		return <CompactPresetRow preset={preset} onFork={onFork} />;
	}

	const canCollapse = onToggleExpanded !== undefined;
	const isExpanded = expanded ?? true;
	const patch = (partial: Partial<CardAIPreset>) =>
		onChange?.(preset.id, partial);

	if (canCollapse && !isExpanded) {
		const summary = presetSummary(preset);
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

	const policy = resolveCardAIPolicy(preset);

	const autoApplyId = `card-ai-auto-${preset.id}`;
	const autoApplyNewId = `card-ai-auto-new-${preset.id}`;
	const sourceNoteId = `card-ai-src-${preset.id}`;
	const relatedCardsId = `card-ai-rel-${preset.id}`;

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
				<span class="tr-preset-editor__enabled">Enabled</span>
				<ToggleInput
					value={!preset.disabled}
					onChange={(enabled) => patch({ disabled: !enabled })}
					ariaLabel={`${preset.disabled ? "Enable" : "Disable"} ${preset.name}`}
				/>
			</div>

			<div class="tr-preset-field tr-preset-field--name">
				<span class="tr-preset-field__label">Name</span>
				<TextInput
					value={preset.name}
					onChange={(v) => patch({ name: v })}
					ariaLabel="Preset name"
				/>
			</div>

			<div class="tr-preset-editor__grid tr-preset-editor__grid--three">
				<div class="tr-preset-field">
					<span class="tr-preset-field__label">Operation</span>
					<SelectInput
						value={policy.mode}
						onChange={(value) => patch({ mode: value as CardAIPresetMode })}
						options={MODE_OPTIONS}
						disabled={policy.executor !== "ai"}
						ariaLabel="Card Polish operation"
						class="tr-preset-select"
					/>
				</div>
				<div class="tr-preset-field">
					<span class="tr-preset-field__label">Editable fields</span>
					<SelectInput
						value={policy.fieldScope}
						onChange={(value) =>
							patch({ fieldScope: value as CardAIFieldScope })
						}
						options={FIELD_SCOPE_OPTIONS}
						ariaLabel="Card Polish editable fields"
						class="tr-preset-select"
					/>
				</div>
				<div class="tr-preset-field">
					<span class="tr-preset-field__label">Executor</span>
					<SelectInput
						value={policy.executor}
						onChange={(value) =>
							patch({
								executor: value as CardAIExecutor,
								...(value === "ai" ? {} : { mode: "edit" }),
							})
						}
						options={EXECUTOR_OPTIONS}
						ariaLabel="Card Polish executor"
						class="tr-preset-select"
					/>
				</div>
			</div>

			<div class="tr-preset-field tr-preset-field--full">
				<span class="tr-preset-field__label">Prompt</span>
				<TextAreaInput
					value={preset.prompt}
					onChange={(v) => patch({ prompt: v })}
					rows={4}
					class="ep:font-mono ep:text-ui-smaller"
					ariaLabel="Card Polish prompt"
				/>
			</div>

			<div class="ep:flex ep:flex-col ep:gap-1 ep:min-w-0">
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
					Hotkey
				</span>
				<span class="ep:text-ui-smaller ep:text-obs-muted">
					Assign in Obsidian's Hotkeys settings — search for "Polish:{" "}
					{preset.name}".
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

			<div class="ep:flex ep:flex-col ep:gap-2 ep:p-2 ep:border ep:border-obs-border ep:rounded">
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
					Auto-apply
				</span>
				<label
					for={autoApplyId}
					class="ep:flex ep:items-start ep:gap-2 ep:text-ui-small ep:cursor-pointer"
				>
					<input
						id={autoApplyId}
						type="checkbox"
						checked={preset.autoApply}
						onChange={(e) =>
							patch({ autoApply: (e.target as HTMLInputElement).checked })
						}
					/>
					<span class="ep:flex ep:flex-col">
						<span>Auto-apply edits to current card</span>
						<span class="ep:text-ui-smaller ep:text-obs-muted">
							Skip preview when the model only modifies the current card
						</span>
					</span>
				</label>
				<label
					for={autoApplyNewId}
					class="ep:flex ep:items-start ep:gap-2 ep:text-ui-small ep:cursor-pointer"
				>
					<input
						id={autoApplyNewId}
						type="checkbox"
						checked={!!preset.autoApplyNewCards}
						onChange={(e) =>
							patch({
								autoApplyNewCards: (e.target as HTMLInputElement).checked,
							})
						}
					/>
					<span class="ep:flex ep:flex-col">
						<span>Auto-apply new cards spawned by AI</span>
						<span class="ep:text-ui-smaller ep:text-obs-muted">
							Tip: AI spawns new cards only when your prompt asks for them
						</span>
					</span>
				</label>
			</div>

			<div class="ep:flex ep:items-center ep:justify-end ep:gap-2 ep:pt-1">
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
	);
}
