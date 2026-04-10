import type { TFile } from "obsidian";
import { useCallback, useState } from "preact/hooks";

import type { ToolbarButtonConfig } from "@true-recall/core/types";

import { Clickable } from "@true-recall/obsidian/components";

import { BUILTIN_BUTTONS } from "./toolbar-buttons";

export interface ToolbarActions {
	onGenerate: (text: string, sourceFile?: TFile | null) => Promise<void>;
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
	detectedImagePath?: string | null;
}

export function SelectionToolbar({
	selectedText,
	buttons,
	actions,
	hasApiKey,
	detectedImagePath,
}: SelectionToolbarProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(() => {
		void navigator.clipboard.writeText(selectedText).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}, [selectedText]);

	const enabledButtons = buttons.filter((b) => b.enabled);

	return (
		<div class="true-recall-selection-toolbar ep:flex ep:items-center ep:gap-0.5 ep:p-1">
			{enabledButtons.map((btn, i) => (
				<ToolbarButton
					key={btn.id}
					config={btn}
					actions={actions}
					selectedText={selectedText}
					hasApiKey={hasApiKey}
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
	detectedImagePath,
	copied,
	onCopy,
	showDivider,
}: ToolbarButtonProps) {
	const builtin = BUILTIN_BUTTONS.find((b) => b.id === config.id);

	switch (config.id) {
		case "flashcards":
			return (
				<>
					{showDivider && <span class="true-recall-st-divider" />}
					<Clickable
						class={`true-recall-st-btn ${!hasApiKey ? "true-recall-st-btn-disabled" : ""}`}
						disabled={!hasApiKey}
						onClick={() => {
							if (!hasApiKey) return;
							actions.onDismiss();
							void actions.onGenerate(selectedText);
						}}
						title={
							hasApiKey
								? "Generate flashcard(s) with AI"
								: "Add an OpenRouter API key in settings"
						}
					>
						<span>Flashcards</span>
					</Clickable>
				</>
			);

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
						<span>IO</span>
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
