import { useEffect } from "preact/hooks";

import type { IODrawingTool, IOEditorTool } from "../types";

interface UseIOEditorShortcutsOptions {
	hasRegions: boolean;
	selectedRegionId: string | null;
	onDeleteSelected: () => void;
	onToolChange: (tool: IOEditorTool) => void;
	onDrawingToolChange: (tool: IODrawingTool) => void;
}

function isFormControl(target: EventTarget | null): boolean {
	const tagName = (target as HTMLElement | null)?.tagName;
	return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

export function useIOEditorShortcuts({
	hasRegions,
	selectedRegionId,
	onDeleteSelected,
	onToolChange,
	onDrawingToolChange,
}: UseIOEditorShortcutsOptions): void {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (isFormControl(event.target)) return;

			if (
				(event.key === "Delete" || event.key === "Backspace") &&
				selectedRegionId
			) {
				event.preventDefault();
				onDeleteSelected();
				return;
			}

			switch (event.key.toLowerCase()) {
				case "v":
					if (hasRegions) onToolChange("select");
					break;
				case "r":
					onDrawingToolChange("rect");
					onToolChange("rect");
					break;
				case "e":
					onDrawingToolChange("ellipse");
					onToolChange("ellipse");
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		hasRegions,
		onDeleteSelected,
		onDrawingToolChange,
		onToolChange,
		selectedRegionId,
	]);
}
