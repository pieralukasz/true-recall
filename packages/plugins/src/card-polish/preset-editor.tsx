import type { CardPolishPreset } from "@true-recall/core";

import {
	ActionButton,
	TextAreaInput,
	TextInput,
} from "@true-recall/obsidian/components";

interface PresetEditorProps {
	preset: CardPolishPreset;
	onChange: (next: CardPolishPreset) => void;
	onFork: () => void;
	onDelete?: () => void;
}

export function PresetEditor({
	preset,
	onChange,
	onFork,
	onDelete,
}: PresetEditorProps) {
	const readOnly = preset.builtin;
	const patch = (partial: Partial<CardPolishPreset>) =>
		onChange({ ...preset, ...partial });

	const autoApplyId = `card-polish-auto-${preset.id}`;

	return (
		<div class="ep:flex ep:flex-col ep:gap-3 ep:p-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary">
			<div class="ep:flex ep:items-center ep:gap-2">
				<span class="ep:text-ui-small ep:font-semibold ep:text-obs-normal ep:flex-1 ep:truncate">
					{preset.name}
				</span>
				{preset.builtin && (
					<span class="ep:text-ui-smallest ep:font-semibold ep:px-1.5 ep:py-0.5 ep:rounded ep:bg-obs-border ep:text-obs-muted ep:uppercase">
						Built-in
					</span>
				)}
			</div>

			<div class="ep:flex ep:flex-col ep:gap-1">
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
					Name
				</span>
				<TextInput
					value={preset.name}
					disabled={readOnly}
					onChange={(v) => patch({ name: v })}
				/>
			</div>

			<div class="ep:flex ep:flex-col ep:gap-1">
				<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
					Prompt
				</span>
				<TextAreaInput
					value={preset.prompt}
					disabled={readOnly}
					onChange={(v) => patch({ prompt: v })}
					rows={4}
					class="ep:font-mono ep:text-ui-smaller"
				/>
			</div>

			<div class="ep:grid ep:grid-cols-1 sm:ep:grid-cols-2 ep:gap-3">
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
				<div class="ep:flex ep:flex-col ep:gap-1 ep:min-w-0">
					<span class="ep:text-ui-smaller ep:text-obs-muted ep:font-medium">
						Model override
					</span>
					<TextInput
						value={preset.modelOverride ?? ""}
						placeholder="e.g. anthropic/claude-haiku-4-5"
						onChange={(v) => patch({ modelOverride: v || undefined })}
					/>
				</div>
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
						disabled={readOnly}
						onChange={(e) =>
							patch({ autoApply: (e.target as HTMLInputElement).checked })
						}
					/>
					<span>Auto-apply</span>
				</label>
				<div class="ep:flex ep:gap-2">
					{readOnly ? (
						<ActionButton
							label="Fork to edit"
							variant="outline"
							size="sm"
							onClick={onFork}
						/>
					) : (
						onDelete && (
							<ActionButton
								label="Delete"
								variant="danger"
								size="sm"
								onClick={onDelete}
							/>
						)
					)}
				</div>
			</div>
		</div>
	);
}
