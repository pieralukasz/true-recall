import type { CardAIPreset } from "@true-recall/core";

import {
	ActionButton,
	TextAreaInput,
	TextInput,
} from "@true-recall/obsidian/components";

interface CardAIPresetEditorProps {
	preset: CardAIPreset;
	readOnly?: boolean;
	onChange?: (next: CardAIPreset) => void;
	onFork?: () => void;
	onDelete?: () => void;
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

export function CardAIPresetEditor({
	preset,
	readOnly,
	onChange,
	onFork,
	onDelete,
}: CardAIPresetEditorProps) {
	const isReadOnly = readOnly ?? preset.builtin;

	if (isReadOnly) {
		return <CompactPresetRow preset={preset} onFork={onFork} />;
	}

	const patch = (partial: Partial<CardAIPreset>) =>
		onChange?.({ ...preset, ...partial });

	const autoApplyId = `card-ai-auto-${preset.id}`;
	const sourceNoteId = `card-ai-src-${preset.id}`;
	const relatedCardsId = `card-ai-rel-${preset.id}`;

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
				<TextInput
					value={preset.hotkey ?? ""}
					placeholder="Mod+Alt+F"
					onChange={(v) => patch({ hotkey: v || undefined })}
				/>
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
				<label
					for={autoApplyId}
					class="ep:flex ep:items-center ep:gap-2 ep:text-ui-small ep:text-obs-normal ep:cursor-pointer"
				>
					<input
						id={autoApplyId}
						type="checkbox"
						checked={preset.autoApply}
						onChange={(e) =>
							patch({ autoApply: (e.target as HTMLInputElement).checked })
						}
					/>
					<span>Auto-apply</span>
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
