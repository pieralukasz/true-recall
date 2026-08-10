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
			class={cn(
				"ep:w-4 ep:h-4 ep:text-obs-muted ep:transition-transform ep:duration-200 ep:flex-shrink-0",
				expanded && "ep:rotate-90",
			)}
		/>
	);
}

function BadgeRow({ preset }: { preset: CardAIPreset }) {
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

	if (canCollapse && !isExpanded) {
		const summary = presetSummary(preset);
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

	const patch = (partial: Partial<CardAIPreset>) =>
		onChange?.(preset.id, partial);
	const policy = resolveCardAIPolicy(preset);

	const autoApplyId = `card-ai-auto-${preset.id}`;
	const autoApplyNewId = `card-ai-auto-new-${preset.id}`;
	const sourceNoteId = `card-ai-src-${preset.id}`;
	const relatedCardsId = `card-ai-rel-${preset.id}`;

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

			<div class="ep:grid ep:grid-cols-1 ep:gap-2 ep:sm:grid-cols-3">
				<div class="ep:flex ep:flex-col ep:gap-1">
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
						Operation
					</span>
					<SelectInput
						value={policy.mode}
						onChange={(value) => patch({ mode: value as CardAIPresetMode })}
						options={MODE_OPTIONS}
						disabled={policy.executor !== "ai"}
						ariaLabel="Card Polish operation"
					/>
				</div>
				<div class="ep:flex ep:flex-col ep:gap-1">
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
						Editable fields
					</span>
					<SelectInput
						value={policy.fieldScope}
						onChange={(value) =>
							patch({ fieldScope: value as CardAIFieldScope })
						}
						options={FIELD_SCOPE_OPTIONS}
						ariaLabel="Card Polish editable fields"
					/>
				</div>
				<div class="ep:flex ep:flex-col ep:gap-1">
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
						Executor
					</span>
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
					/>
				</div>
			</div>

			<div class="ep:flex ep:flex-col ep:gap-1">
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
					Prompt
				</span>
				<TextAreaInput
					value={preset.prompt}
					onChange={(v) => patch({ prompt: v })}
					rows={4}
					class="ep:font-mono ep:text-ui-smaller"
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
