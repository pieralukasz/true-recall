import { useCallback } from "preact/hooks";

import type { ToolbarButtonConfig } from "@true-recall/core/types";

import { Clickable } from "@true-recall/obsidian/components";

import { BUTTON_PLUGIN_MAP } from "../registry";

export interface ImageToolbarActions {
	onQuickAdd: () => Promise<void>;
	onEdit: () => void;
	onImageOcclusion: () => void;
	onDismiss: () => void;
}

interface ImageToolbarProps {
	buttons: ToolbarButtonConfig[];
	actions: ImageToolbarActions;
	pluginStates?: Record<string, boolean>;
}

export function ImageToolbar({
	buttons,
	actions,
	pluginStates = {},
}: ImageToolbarProps) {
	const enabledButtons = buttons.filter((b) => {
		if (!b.enabled) return false;
		const pluginInfo = BUTTON_PLUGIN_MAP.get(b.id);
		if (pluginInfo && pluginStates[pluginInfo.pluginId] === false) return false;
		return IMAGE_TOOLBAR_BUTTONS.has(b.id);
	});

	return (
		<div class="true-recall-selection-toolbar ep:flex ep:items-center ep:gap-0.5 ep:p-1">
			{enabledButtons.map((btn, i) => (
				<ImageToolbarButton
					key={btn.id}
					id={btn.id}
					actions={actions}
					showDivider={i > 0}
				/>
			))}
		</div>
	);
}

interface ImageToolbarButtonProps {
	id: string;
	actions: ImageToolbarActions;
	showDivider: boolean;
}

function ImageToolbarButton({
	id,
	actions,
	showDivider,
}: ImageToolbarButtonProps) {
	const handleQuickAdd = useCallback(async () => {
		actions.onDismiss();
		await actions.onQuickAdd();
	}, [actions]);

	const handleEdit = useCallback(() => {
		actions.onDismiss();
		actions.onEdit();
	}, [actions]);

	const handleIO = useCallback(() => {
		actions.onDismiss();
		actions.onImageOcclusion();
	}, [actions]);

	switch (id) {
		case "io":
			return (
				<>
					{showDivider && <span class="true-recall-st-divider" />}
					<Clickable
						class="true-recall-st-btn"
						onClick={handleIO}
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
						onClick={handleEdit}
						title="Open in flashcard editor with image"
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
						onClick={() => void handleQuickAdd()}
						title="Quick add image as flashcard question"
					>
						<span>Quick+</span>
					</Clickable>
				</>
			);

		default:
			return null;
	}
}

export const IMAGE_TOOLBAR_BUTTONS = new Set(["io", "edit", "quick-add"]);
