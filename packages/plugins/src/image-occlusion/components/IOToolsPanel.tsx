import type { IODrawingTool, IOEditorTool } from "../types";
import { IOAIDetectionControls } from "./IOAIDetectionControls";
import { IconToolButton } from "./IOIconToolButton";

interface IOToolsPanelProps {
	tool: IOEditorTool;
	hasRegions: boolean;
	selectedRegionId: string | null;
	aiPromptVisible: boolean;
	aiLoading: boolean;
	aiCustomHint: string;
	hasAIKey: boolean;
	hasImage: boolean;
	onToolChange: (tool: IOEditorTool) => void;
	onDrawingToolChange: (tool: IODrawingTool) => void;
	onDeleteSelected: () => void;
	onToggleAiPrompt: () => void;
	onAiCustomHintChange: (hint: string) => void;
	onAiDetect: (hint?: string) => void;
}

export function IOToolsPanel({
	tool,
	hasRegions,
	selectedRegionId,
	aiPromptVisible,
	aiLoading,
	aiCustomHint,
	hasAIKey,
	hasImage,
	onToolChange,
	onDrawingToolChange,
	onDeleteSelected,
	onToggleAiPrompt,
	onAiCustomHintChange,
	onAiDetect,
}: IOToolsPanelProps) {
	return (
		<div class="true-recall-io-side-section">
			<div class="ep:text-ui-small ep:font-medium ep:mb-1">Tools</div>
			<div class="true-recall-io-tool-row">
				{hasRegions && (
					<IconToolButton
						icon="mouse-pointer-2"
						label="Select"
						shortcut="V"
						active={tool === "select"}
						onClick={() => onToolChange("select")}
					/>
				)}
				<IconToolButton
					icon="square"
					label="Rectangle"
					shortcut="R"
					active={tool === "rect"}
					onClick={() => {
						onDrawingToolChange("rect");
						onToolChange("rect");
					}}
				/>
				<IconToolButton
					icon="circle"
					label="Ellipse"
					shortcut="E"
					active={tool === "ellipse"}
					onClick={() => {
						onDrawingToolChange("ellipse");
						onToolChange("ellipse");
					}}
				/>
				<IconToolButton
					icon="sparkles"
					label="AI detect regions"
					active={aiPromptVisible}
					disabled={!hasImage || aiLoading || !hasAIKey}
					onClick={onToggleAiPrompt}
				/>
				{selectedRegionId && (
					<IconToolButton
						icon="trash-2"
						label="Delete selected region"
						shortcut="Delete"
						danger
						onClick={onDeleteSelected}
					/>
				)}
			</div>
			<div class="true-recall-io-hint-text">
				Shortcuts: Delete to remove, Space + drag to pan, Ctrl/Cmd+V to paste.
				Click a region to switch to Select.
			</div>
			<IOAIDetectionControls
				visible={aiPromptVisible}
				loading={aiLoading}
				hint={aiCustomHint}
				onHintChange={onAiCustomHintChange}
				onDetect={onAiDetect}
				onCancel={onToggleAiPrompt}
			/>
		</div>
	);
}
