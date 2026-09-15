import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import {
	clamp,
	normalizePointFromRect,
} from "@true-recall/core/utils/canvas-geometry";

import type { IODefinition, IOEditorTool, IORegion, IOShape } from "../types";
import {
	buildDraftRegion,
	buildMoveUpdate,
	buildResizeUpdate,
	commitDraftRegion,
	type ResizeCorner,
	updateRegion,
} from "../utils/canvas-interactions";

type DragState =
	| { type: "draw"; startX: number; startY: number; shape: IOShape }
	| { type: "move"; regionId: string; offsetX: number; offsetY: number }
	| { type: "resize"; regionId: string; corner: ResizeCorner }
	| {
			type: "pan";
			startClientX: number;
			startClientY: number;
			originX: number;
			originY: number;
	  };

interface UseIOCanvasInteractionsOptions {
	definition: IODefinition;
	tool: IOEditorTool;
	onToolChange?: (tool: IOEditorTool) => void;
	panX: number;
	panY: number;
	zoom: number;
	onDefinitionChange: (definition: IODefinition) => void;
	onSelectRegion: (regionId: string | null) => void;
	onZoomChange: (zoom: number) => void;
	onPanChange: (x: number, y: number) => void;
}

function useLatest<T>(value: T) {
	const ref = useRef(value);
	ref.current = value;
	return ref;
}

function getNormalizedPoint(
	event: PointerEvent,
	mediaElement: HTMLElement | null,
): { x: number; y: number } | null {
	if (!mediaElement) return null;
	return normalizePointFromRect(
		event.clientX,
		event.clientY,
		mediaElement.getBoundingClientRect(),
	);
}

export function useIOCanvasInteractions({
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
}: UseIOCanvasInteractionsOptions) {
	const mediaRef = useRef<HTMLDivElement | null>(null);
	const dragRef = useRef<DragState | null>(null);
	const [spacePressed, setSpacePressed] = useState(false);
	const [draftRegion, setDraftRegion] = useState<IORegion | null>(null);

	const latest = useLatest({
		definition,
		tool,
		spacePressed,
		panX,
		panY,
		onDefinitionChange,
		onPanChange,
		onSelectRegion,
		onToolChange,
		draftRegion,
	});

	const cancelInteraction = useCallback(() => {
		dragRef.current = null;
		setDraftRegion(null);
	}, []);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.code === "Space") setSpacePressed(true);
		};
		const handleKeyUp = (event: KeyboardEvent) => {
			if (event.code === "Space") setSpacePressed(false);
		};
		const handleBlur = () => {
			setSpacePressed(false);
			cancelInteraction();
		};

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		window.addEventListener("blur", handleBlur);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
			window.removeEventListener("blur", handleBlur);
		};
	}, [cancelInteraction]);

	const handlePointerDown = useCallback(
		(event: PointerEvent) => {
			if (event.button !== 0 && event.button !== 1) return;

			const target = event.target as Element;
			const regionId = target.getAttribute("data-io-region");
			const resizeCorner = target.getAttribute(
				"data-io-handle",
			) as ResizeCorner | null;
			const currentTool = latest.current.tool;

			if (latest.current.spacePressed || event.button === 1) {
				dragRef.current = {
					type: "pan",
					startClientX: event.clientX,
					startClientY: event.clientY,
					originX: latest.current.panX,
					originY: latest.current.panY,
				};
				(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
				return;
			}

			if (regionId) {
				latest.current.onSelectRegion(regionId);
				if (currentTool !== "select") {
					latest.current.onToolChange?.("select");
					return;
				}
			} else if (!resizeCorner && currentTool === "select") {
				latest.current.onSelectRegion(null);
			}

			const point = getNormalizedPoint(event, mediaRef.current);
			if (!point) return;

			if (resizeCorner && regionId) {
				dragRef.current = {
					type: "resize",
					regionId,
					corner: resizeCorner,
				};
				(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
				return;
			}

			if (regionId) {
				const region = latest.current.definition.regions.find(
					(item) => item.id === regionId,
				);
				if (!region) return;
				dragRef.current = {
					type: "move",
					regionId,
					offsetX: point.x - region.x,
					offsetY: point.y - region.y,
				};
				(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
				return;
			}

			if (currentTool === "rect" || currentTool === "ellipse") {
				dragRef.current = {
					type: "draw",
					startX: point.x,
					startY: point.y,
					shape: currentTool,
				};
				(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
			}
		},
		[latest],
	);

	const handlePointerMove = useCallback(
		(event: PointerEvent) => {
			const drag = dragRef.current;
			if (!drag) return;

			if (drag.type === "pan") {
				latest.current.onPanChange(
					drag.originX + event.clientX - drag.startClientX,
					drag.originY + event.clientY - drag.startClientY,
				);
				return;
			}

			const point = getNormalizedPoint(event, mediaRef.current);
			if (!point) return;
			if (drag.type === "draw") {
				setDraftRegion(
					buildDraftRegion(
						drag.startX,
						drag.startY,
						point.x,
						point.y,
						drag.shape,
					),
				);
				return;
			}

			const currentDefinition = latest.current.definition;
			if (drag.type === "move") {
				latest.current.onDefinitionChange(
					updateRegion(currentDefinition, drag.regionId, (region) => ({
						...region,
						...buildMoveUpdate(region, point, {
							x: drag.offsetX,
							y: drag.offsetY,
						}),
					})),
				);
				return;
			}

			latest.current.onDefinitionChange(
				updateRegion(currentDefinition, drag.regionId, (region) => ({
					...region,
					...buildResizeUpdate(region, drag.corner, point),
				})),
			);
		},
		[latest],
	);

	const handlePointerUp = useCallback(() => {
		const drag = dragRef.current;
		if (!drag) return;

		if (drag.type === "draw" && latest.current.draftRegion) {
			const result = commitDraftRegion(
				latest.current.definition,
				latest.current.draftRegion,
			);
			if (result) {
				latest.current.onDefinitionChange(result.definition);
				latest.current.onSelectRegion(result.regionId);
			}
		}
		cancelInteraction();
	}, [cancelInteraction, latest]);

	const handleWheel = useCallback(
		(event: WheelEvent) => {
			event.preventDefault();
			const multiplier = event.deltaY < 0 ? 1.12 : 0.88;
			onZoomChange(clamp(zoom * multiplier, 0.5, 4));
		},
		[onZoomChange, zoom],
	);

	return {
		mediaRef,
		spacePressed,
		draftRegion,
		handlePointerDown,
		handlePointerMove,
		handlePointerUp,
		handleLostPointerCapture: cancelInteraction,
		handleWheel,
	};
}
