import type { CardPolishPreset } from "@true-recall/core";

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

	return (
		<div className="tr-card-polish-preset-editor">
			<label className="tr-card-polish-preset-field">
				<span>Name</span>
				<input
					type="text"
					value={preset.name}
					disabled={readOnly}
					onInput={(e) => patch({ name: (e.target as HTMLInputElement).value })}
				/>
			</label>
			<label className="tr-card-polish-preset-field">
				<span>Prompt</span>
				<textarea
					rows={6}
					value={preset.prompt}
					disabled={readOnly}
					onInput={(e) =>
						patch({ prompt: (e.target as HTMLTextAreaElement).value })
					}
				/>
			</label>
			<label className="tr-card-polish-preset-field">
				<span>Hotkey</span>
				<input
					type="text"
					placeholder="Mod+Alt+F"
					value={preset.hotkey ?? ""}
					onInput={(e) =>
						patch({
							hotkey: (e.target as HTMLInputElement).value || undefined,
						})
					}
				/>
			</label>
			<label className="tr-card-polish-preset-field">
				<span>Auto-apply</span>
				<input
					type="checkbox"
					checked={preset.autoApply}
					disabled={readOnly}
					onChange={(e) =>
						patch({ autoApply: (e.target as HTMLInputElement).checked })
					}
				/>
			</label>
			<label className="tr-card-polish-preset-field">
				<span>Model override</span>
				<input
					type="text"
					placeholder="e.g. anthropic/claude-haiku-4-5"
					value={preset.modelOverride ?? ""}
					onInput={(e) =>
						patch({
							modelOverride: (e.target as HTMLInputElement).value || undefined,
						})
					}
				/>
			</label>
			<div className="tr-card-polish-preset-editor-actions">
				{readOnly ? (
					<button type="button" onClick={onFork}>
						Fork to edit
					</button>
				) : (
					onDelete && (
						<button type="button" onClick={onDelete}>
							Delete
						</button>
					)
				)}
			</div>
		</div>
	);
}
