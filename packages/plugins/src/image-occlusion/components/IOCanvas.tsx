import { cn } from "@true-recall/obsidian/utils/cn";

import { useIOCanvasInteractions } from "../hooks/useIOCanvasInteractions";
import type { IODefinition, IOEditorTool } from "../types";
import { IOCanvasRegionLayer } from "./IOCanvasRegionLayer";
import { IOCanvasToolbar } from "./IOCanvasToolbar";

interface IOCanvasProps {
	imageUrl: string | null;
	definition: IODefinition;
	tool: IOEditorTool;
	onToolChange?: (tool: IOEditorTool) => void;
	selectedRegionId: string | null;
	zoom: number;
	panX: number;
	panY: number;
	onDefinitionChange: (definition: IODefinition) => void;
	onSelectRegion: (regionId: string | null) => void;
	onZoomChange: (zoom: number) => void;
	onPanChange: (x: number, y: number) => void;
}

export function IOCanvas({
	imageUrl,
	definition,
	tool,
	onToolChange,
	selectedRegionId,
	zoom,
	panX,
	panY,
	onDefinitionChange,
	onSelectRegion,
	onZoomChange,
	onPanChange,
}: IOCanvasProps) {
	const interactions = useIOCanvasInteractions({
		definition,
		tool,
		onToolChange,
		panX,
		panY,
		zoom,
		onDefinitionChange,
		onSelectRegion,
		onZoomChange,
		onPanChange,
	});
	const selectedRegion =
		definition.regions.find((region) => region.id === selectedRegionId) ?? null;

	if (!imageUrl) {
		return (
			<div class="true-recall-io-canvas-empty">
				Select or paste an image to start drawing masks.
			</div>
		);
	}

	return (
		<div class="true-recall-io-canvas-wrap">
			<div
				class={cn(
					"true-recall-io-canvas-stage",
					`tool-${tool}`,
					interactions.spacePressed && "is-panning",
				)}
				onPointerDown={interactions.handlePointerDown}
				onPointerMove={interactions.handlePointerMove}
				onPointerUp={interactions.handlePointerUp}
				onLostPointerCapture={interactions.handleLostPointerCapture}
				onWheel={interactions.handleWheel}
			>
				<IOCanvasToolbar
					zoom={zoom}
					onZoomChange={onZoomChange}
					onResetView={() => {
						onZoomChange(1);
						onPanChange(0, 0);
					}}
				/>
				<div class="true-recall-io-canvas-shortcuts" title="Editor shortcuts">
					<kbd>Space + drag</kbd> pan
				</div>
				<div
					class="true-recall-io-canvas-transform"
					style={{
						transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
					}}
				>
					<div ref={interactions.mediaRef} class="true-recall-io-canvas-media">
						<img
							src={imageUrl}
							alt="Occlusion source"
							draggable={false}
							class="true-recall-io-canvas-image"
						/>
						<IOCanvasRegionLayer
							regions={definition.regions}
							draftRegion={interactions.draftRegion}
							selectedRegion={selectedRegion}
							selectedRegionId={selectedRegionId}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
