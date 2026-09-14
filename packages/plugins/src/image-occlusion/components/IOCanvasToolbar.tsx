import { clamp } from "@true-recall/core/utils/canvas-geometry";

import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";

interface CanvasIconButtonProps {
	icon: string;
	label: string;
	onClick: () => void;
}

function CanvasIconButton({ icon, label, onClick }: CanvasIconButtonProps) {
	const iconRef = useIcon(icon);

	return (
		<Clickable
			class="true-recall-io-canvas-zoombar-btn"
			aria-label={label}
			title={label}
			onClick={onClick}
		>
			<span ref={iconRef} />
		</Clickable>
	);
}

interface IOCanvasToolbarProps {
	zoom: number;
	onZoomChange: (zoom: number) => void;
	onResetView: () => void;
}

export function IOCanvasToolbar({
	zoom,
	onZoomChange,
	onResetView,
}: IOCanvasToolbarProps) {
	return (
		<div
			class="true-recall-io-canvas-zoombar"
			onPointerDown={(event) => event.stopPropagation()}
		>
			<CanvasIconButton
				icon="minus"
				label="Zoom out"
				onClick={() => onZoomChange(clamp(zoom * 0.88, 0.5, 4))}
			/>
			<span class="true-recall-io-canvas-zoombar-percent">
				{Math.round(zoom * 100)}%
			</span>
			<CanvasIconButton
				icon="plus"
				label="Zoom in"
				onClick={() => onZoomChange(clamp(zoom * 1.12, 0.5, 4))}
			/>
			<CanvasIconButton
				icon="maximize"
				label="Fit view"
				onClick={onResetView}
			/>
		</div>
	);
}
