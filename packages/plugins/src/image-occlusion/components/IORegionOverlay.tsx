import type { IOMaskMode } from "@true-recall/core/types/image-occlusion.types";

import { cn } from "@true-recall/obsidian/utils/cn";

import type { RenderableIORegion } from "../utils/card-rendering";
import { getRegionVisualState } from "../utils/card-rendering";

interface IORegionOverlayProps {
	regions: RenderableIORegion[];
	activeOrdinal: number;
	revealed: boolean;
	maskMode: IOMaskMode;
	revealSingleOnly?: boolean;
	hideOtherRegions?: boolean;
	onRegionClick?: (ordinal: number) => void;
}

interface IORegionShapeProps {
	info: RenderableIORegion;
	className: string;
	onActivate?: () => void;
}

function IORegionShape({ info, className, onActivate }: IORegionShapeProps) {
	const interactionProps = onActivate
		? {
				onClick: (event: Event) => {
					event.stopPropagation();
					onActivate();
				},
				onKeyDown: (event: KeyboardEvent) => {
					if (event.key !== "Enter" && event.key !== " ") return;
					event.preventDefault();
					event.stopPropagation();
					onActivate();
				},
				role: "button" as const,
				tabIndex: 0,
				"aria-label": `Region ${info.ordinal + 1}`,
			}
		: {};
	const { region } = info;

	if (region.shape === "ellipse") {
		return (
			<ellipse
				key={region.id}
				class={className}
				cx={region.x + region.w / 2}
				cy={region.y + region.h / 2}
				rx={region.w / 2}
				ry={region.h / 2}
				{...interactionProps}
			/>
		);
	}

	return (
		<rect
			key={region.id}
			class={className}
			x={region.x}
			y={region.y}
			width={region.w}
			height={region.h}
			rx={0.01}
			ry={0.01}
			{...interactionProps}
		/>
	);
}

export function IORegionOverlay({
	regions,
	activeOrdinal,
	revealed,
	maskMode,
	revealSingleOnly = false,
	hideOtherRegions = false,
	onRegionClick,
}: IORegionOverlayProps) {
	return (
		<svg
			class="true-recall-io-render-svg"
			viewBox="0 0 1 1"
			preserveAspectRatio="none"
			aria-hidden={onRegionClick ? undefined : "true"}
		>
			<title>Image occlusion regions</title>
			{regions.map((info) => (
				<IORegionShape
					key={info.region.id}
					info={info}
					className={cn(
						"true-recall-io-shape",
						getRegionVisualState(
							info.ordinal,
							activeOrdinal,
							revealed,
							maskMode,
							revealSingleOnly,
							hideOtherRegions,
						),
						onRegionClick && "true-recall-io-shape-clickable",
					)}
					onActivate={
						onRegionClick ? () => onRegionClick(info.ordinal) : undefined
					}
				/>
			))}
		</svg>
	);
}
