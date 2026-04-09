import { Clickable } from "@true-recall/obsidian/components";

import { IconToolButton } from "./IOIconToolButton";

type Tool = "select" | "rect" | "ellipse";

export interface IOToolsPanelProps {
	tool: Tool;
	hasRegions: boolean;
	selectedRegionId: string | null;
	aiPromptVisible: boolean;
	aiLoading: boolean;
	aiCustomHint: string;
	hasAIKey: boolean;
	hasImage: boolean;
	onToolChange: (tool: Tool) => void;
	onSetLastNonSelectTool: (tool: "rect" | "ellipse") => void;
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
	onSetLastNonSelectTool,
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
						onSetLastNonSelectTool("rect");
						onToolChange("rect");
					}}
				/>
				<IconToolButton
					icon="circle"
					label="Ellipse"
					shortcut="E"
					active={tool === "ellipse"}
					onClick={() => {
						onSetLastNonSelectTool("ellipse");
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
			{aiPromptVisible && !aiLoading && (
				<div class="ep:flex ep:flex-col ep:gap-1.5 ep:mt-1">
					<input
						type="text"
						class="ep:w-full ep:px-2 ep:py-1.5 ep:text-ui-small ep:bg-obs-primary ep:border ep:border-obs-border ep:rounded"
						placeholder="Optional hint, e.g. 'label the bones'"
						maxLength={50}
						value={aiCustomHint}
						onInput={(e) =>
							onAiCustomHintChange((e.target as HTMLInputElement).value)
						}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								onAiDetect(aiCustomHint);
							} else if (e.key === "Escape") {
								onToggleAiPrompt();
							}
						}}
					/>
					<div class="ep:flex ep:gap-2">
						<Clickable
							class="ep:px-3 ep:py-1 ep:text-ui-smaller ep:rounded ep:bg-obs-accent/10 ep:text-obs-accent ep:border ep:border-obs-accent ep:transition-colors"
							onClick={() => onAiDetect(aiCustomHint)}
						>
							Detect
						</Clickable>
						<Clickable
							class="ep:px-3 ep:py-1 ep:text-ui-smaller ep:text-obs-muted ep:hover:text-obs-normal ep:transition-colors"
							onClick={onToggleAiPrompt}
						>
							Cancel
						</Clickable>
					</div>
				</div>
			)}
			{aiLoading && (
				<div class="true-recall-io-hint-text ep:flex ep:items-center ep:gap-2">
					<svg
						viewBox="0 0 24 24"
						width="14"
						height="14"
						class="ep:text-obs-muted"
						aria-hidden="true"
					>
						<circle
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="3"
							fill="none"
							stroke-dasharray="31.4 31.4"
							stroke-linecap="round"
						>
							<animateTransform
								attributeName="transform"
								type="rotate"
								dur="1s"
								from="0 12 12"
								to="360 12 12"
								repeatCount="indefinite"
							/>
						</circle>
					</svg>
					Detecting regions…
				</div>
			)}
		</div>
	);
}
