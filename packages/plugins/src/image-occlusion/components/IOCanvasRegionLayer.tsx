import { cn } from "@true-recall/obsidian/utils/cn";

import type { IORegion } from "../types";
import {
	getRegionCorner,
	type ResizeCorner,
} from "../utils/canvas-interactions";

const RESIZE_CORNERS: ResizeCorner[] = ["nw", "ne", "sw", "se"];

interface CanvasRegionProps {
	region: IORegion;
	selected: boolean;
	inMultiSelection?: boolean;
}

function CanvasRegion({
	region,
	selected,
	inMultiSelection = false,
}: CanvasRegionProps) {
	const commonProps = {
		"data-io-region": region.id,
		class: cn(
			"true-recall-io-canvas-region",
			selected && "is-selected",
			inMultiSelection && "is-multi-selected",
			region.id === "draft" && "is-draft",
		),
	};

	if (region.shape === "ellipse") {
		return (
			<ellipse
				{...commonProps}
				cx={region.x + region.w / 2}
				cy={region.y + region.h / 2}
				rx={region.w / 2}
				ry={region.h / 2}
			/>
		);
	}

	return (
		<rect
			{...commonProps}
			x={region.x}
			y={region.y}
			width={region.w}
			height={region.h}
			rx={0.01}
			ry={0.01}
		/>
	);
}

interface IOCanvasRegionLayerProps {
	regions: IORegion[];
	draftRegion: IORegion | null;
	selectedRegion: IORegion | null;
	selectedRegionId: string | null;
	selectedRegionIds?: readonly string[];
}

export function IOCanvasRegionLayer({
	regions,
	draftRegion,
	selectedRegion,
	selectedRegionId,
	selectedRegionIds,
}: IOCanvasRegionLayerProps) {
	return (
		<svg
			class="true-recall-io-canvas-svg"
			viewBox="0 0 1 1"
			preserveAspectRatio="none"
			aria-hidden="true"
		>
			<title>Image occlusion editor regions</title>
			{regions.map((region) => (
				<CanvasRegion
					key={region.id}
					region={region}
					selected={
						selectedRegionId === region.id ||
						(selectedRegionIds?.includes(region.id) ?? false)
					}
					inMultiSelection={
						(selectedRegionIds?.length ?? 0) > 1 &&
						(selectedRegionIds?.includes(region.id) ?? false)
					}
				/>
			))}
			{draftRegion ? (
				<CanvasRegion region={draftRegion} selected={false} />
			) : null}
			{selectedRegion
				? RESIZE_CORNERS.map((corner) => {
						const point = getRegionCorner(selectedRegion, corner);
						return (
							<circle
								key={`${selectedRegion.id}-${corner}`}
								data-io-region={selectedRegion.id}
								data-io-handle={corner}
								cx={point.x}
								cy={point.y}
								r={0.008}
								class="true-recall-io-canvas-handle"
							/>
						);
					})
				: null}
		</svg>
	);
}
