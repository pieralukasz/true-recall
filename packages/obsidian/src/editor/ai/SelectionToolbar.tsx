import type { TFile } from "obsidian";
import { useCallback, useState } from "preact/hooks";

import type { ToolbarButtonConfig } from "@true-recall/core/types";
import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";

import { Clickable } from "@true-recall/obsidian/components";

import {
	BUILTIN_BUTTONS,
	extractPresetId,
	isPresetButton,
} from "./toolbar-buttons";
import { BUTTON_PLUGIN_MAP } from "@true-recall/plugins";

export interface ToolbarActions {
	onPreset: (
		presetId: string,
		text: string,
		sourceFile?: TFile | null,
	) => Promise<void>;
	onEdit: (text: string) => void;
	onQuickAdd: (text: string, sourceFile?: TFile | null) => Promise<void>;
	onHighlight: () => void;
	onNewNote: (text: string) => Promise<void>;
	onAppend: (text: string) => Promise<void>;
	onImageOcclusion?: (path: string) => void;
	onCommand?: (commandId: string) => void;
	onDismiss: () => void;
}

interface SelectionToolbarProps {
	selectedText: string;
	buttons: ToolbarButtonConfig[];
	actions: ToolbarActions;
	hasApiKey: boolean;
	presets?: GenerationPreset[];
	detectedImagePath?: string | null;
	pluginStates?: Record<string, boolean>;
}

const PRO_BADGE = (
	<span class="ep:text-[9px] ep:px-1 ep:rounded ep:font-semibold ep:bg-obs-accent/15 ep:text-obs-accent ep:leading-none ep:ml-0.5">
		PRO
	</span>
);

export function SelectionToolbar({
	selectedText,
	buttons,
	actions,
	hasApiKey,
	presets,
	detectedImagePath,
	pluginStates = {},
}: SelectionToolbarProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(() => {
		void navigator.clipboard.writeText(selectedText).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}, [selectedText]);

	const enabledButtons = buttons.filter((b) => {
		if (!b.enabled) return false;
		const pluginInfo = BUTTON_PLUGIN_MAP.get(b.id);
		if (pluginInfo && pluginStates[pluginInfo.pluginId] === false) return false;
		return true;
	});

	return (
		<div class="true-recall-selection-toolbar ep:flex ep:items-center ep:gap-0.5 ep:p-1">
			{enabledButtons.map((btn, i) => (
				<ToolbarButton
					key={btn.id}
					config={btn}
					actions={actions}
					selectedText={selectedText}
					hasApiKey={hasApiKey}
					presets={presets}
					detectedImagePath={detectedImagePath}
					copied={copied}
					onCopy={handleCopy}
					showDivider={i > 0}
				/>
			))}
		</div>
	);
}

interface ToolbarButtonProps {
	config: ToolbarButtonConfig;
	actions: ToolbarActions;
	selectedText: string;
	hasApiKey: boolean;
	presets?: GenerationPreset[];
	detectedImagePath?: string | null;
	copied: boolean;
	onCopy: () => void;
	showDivider: boolean;
}

function ToolbarButton({
	config,
	actions,
	selectedText,
	hasApiKey,
	presets,
	detectedImagePath,
	copied,
	onCopy,
	showDivider,
}: ToolbarButtonProps) {
	const builtin = BUILTIN_BUTTONS.find((b) => b.id === config.id);

	switch (config.id) {
		case "io":
			if (!detectedImagePath || !actions.onImageOcclusion) return null;
			return (
				<>
					{showDivider && <span class="true-recall-st-divider" />}
					<Clickable
						class="true-recall-st-btn"
						onClick={() => {
							actions.onDismiss();
							actions.onImageOcclusion?.(detectedImagePath);
						}}
						title="Create image occlusion card"
					>
						<span>IO{PRO_BADGE}</span>
					</Clickable>
				</>
			);

		case "edit":
			return (
				<>
					{showDivider && <span class="true-recall-st-divider" />}
					<Clickable
						class="true-recall-st-btn"
						onClick={() => {
							actions.onDismiss();
							actions.onEdit(selectedText);
						}}
						title="Open in flashcard editor"
					>
						<span>Edit</span>
					</Clickable>
				</>
			);

		case "quick-add":
			return (
				<>
					{showDivider && <span class="true-recall-st-divider" />}
					<Clickable
						class="true-recall-st-btn"
						onClick={() => {
							actions.onDismiss();
							void actions.onQuickAdd(selectedText);
						}}
						title="Quick add as basic flashcard"
					>
						<span>Quick+</span>
					</Clickable>
				</>
			);

		case "highlight":
			return (
				<>
					{showDivider && <span class="true-recall-st-divider" />}
					<Clickable
						class="true-recall-st-btn"
						onClick={() => {
							actions.onHighlight();
							actions.onDismiss();
						}}
						title="Wrap selection with ==highlight=="
					>
						<span>Highlight</span>
					</Clickable>
				</>
			);

		case "copy":
			return (
				<>
					{showDivider && <span class="true-recall-st-divider" />}
					<Clickable
						class="true-recall-st-btn"
						onClick={onCopy}
						title={copied ? "Copied!" : "Copy selection"}
					>
						<span>{copied ? "Copied!" : "Copy"}</span>
					</Clickable>
				</>
			);

		case "new-note":
			return (
				<>
					{showDivider && <span class="true-recall-st-divider" />}
					<Clickable
						class="true-recall-st-btn"
						onClick={() => {
							actions.onDismiss();
							void actions.onNewNote(selectedText);
						}}
						title="Create a new note from selection"
					>
						<span>Note+</span>
					</Clickable>
				</>
			);

		case "append":
			return (
				<>
					{showDivider && <span class="true-recall-st-divider" />}
					<Clickable
						class="true-recall-st-btn"
						onClick={() => {
							actions.onDismiss();
							void actions.onAppend(selectedText);
						}}
						title="Append selection to current note"
					>
						<span>Append</span>
					</Clickable>
				</>
			);

		default: {
			if (isPresetButton(config.id)) {
				const presetId = extractPresetId(config.id);
				const preset = presets?.find((p) => p.id === presetId);
				if (!preset) return null;
				const label =
					preset.name.length > 12
						? `${preset.name.slice(0, 11)}\u2026`
						: preset.name;
				return (
					<>
						{showDivider && <span class="true-recall-st-divider" />}
						<Clickable
							class={`true-recall-st-btn ${!hasApiKey ? "true-recall-st-btn-disabled" : ""}`}
							disabled={!hasApiKey}
							onClick={() => {
								if (!hasApiKey) return;
								actions.onDismiss();
								void actions.onPreset(presetId, selectedText);
							}}
							title={
								hasApiKey
									? `Generate: ${preset.name}`
									: "Add API key in settings"
							}
						>
							<span>
								{label}
								{PRO_BADGE}
							</span>
						</Clickable>
					</>
				);
			}

			if (!actions.onCommand) return null;
			const label = builtin?.label ?? config.id.split(":").pop() ?? config.id;
			return (
				<>
					{showDivider && <span class="true-recall-st-divider" />}
					<Clickable
						class="true-recall-st-btn"
						onClick={() => {
							actions.onDismiss();
							actions.onCommand?.(config.id);
						}}
						title={label}
					>
						<span>{label}</span>
					</Clickable>
				</>
			);
		}
	}
}
