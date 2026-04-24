import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";

import {
	clamp,
	normalizePointFromRect,
} from "@true-recall/core/utils/canvas-geometry";

import { Clickable } from "@true-recall/obsidian/components";
import { useIcon } from "@true-recall/obsidian/preact/hooks";

import type { IODefinition, IORegion, IOShape } from "../types";
import {
	buildDraftRegion,
	buildMoveUpdate,
	buildResizeUpdate,
	commitDraftRegion,
	getRegionCorner,
	type ResizeCorner,
	updateRegion,
} from "../utils/canvas-interactions";

type Tool = "select" | IOShape;

interface IOCanvasProps {
	imageUrl: string | null;
	definition: IODefinition;
	tool: Tool;
	onToolChange?: (tool: Tool) => void;
	selectedRegionId: string | null;
	zoom: number;
	panX: number;
	panY: number;
	onDefinitionChange: (definition: IODefinition) => void;
	onSelectRegion: (regionId: string | null) => void;
	onZoomChange: (zoom: number) => void;
	onPanChange: (x: number, y: number) => void;
}

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
			onClick={() => onClick()}
		>
			<span ref={iconRef} />
		</Clickable>
	);
}

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

function getPoint(
	event: PointerEvent | WheelEvent,
	mediaEl: HTMLElement | null,
): { x: number; y: number } | null {
	if (!mediaEl) return null;
	return normalizePointFromRect(
		event.clientX,
		event.clientY,
		mediaEl.getBoundingClientRect(),
	);
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
	const mediaRef = useRef<HTMLDivElement | null>(null);
	const mediaRefCallback = useCallback((el: HTMLDivElement | null) => {
		mediaRef.current = el;
	}, []);

	const [spacePressed, setSpacePressed] = useState(false);
	const [draftRegion, setDraftRegion] = useState<IORegion | null>(null);

	// Drag state lives in a ref — changes don't need re-renders,
	// and handlers always read the latest value synchronously.
	const dragRef = useRef<DragState | null>(null);

	// Keep latest props/state accessible to pointer handlers without re-creating them
	const definitionRef = useRef(definition);
	definitionRef.current = definition;
	const toolRef = useRef(tool);
	toolRef.current = tool;
	const spacePressedRef = useRef(spacePressed);
	spacePressedRef.current = spacePressed;
	const panXRef = useRef(panX);
	panXRef.current = panX;
	const panYRef = useRef(panY);
	panYRef.current = panY;
	const onDefinitionChangeRef = useRef(onDefinitionChange);
	onDefinitionChangeRef.current = onDefinitionChange;
	const onPanChangeRef = useRef(onPanChange);
	onPanChangeRef.current = onPanChange;
	const onSelectRegionRef = useRef(onSelectRegion);
	onSelectRegionRef.current = onSelectRegion;
	const onToolChangeRef = useRef(onToolChange);
	onToolChangeRef.current = onToolChange;
	const draftRegionRef = useRef(draftRegion);
	draftRegionRef.current = draftRegion;

	const selectedRegion = useMemo(
		() =>
			definition.regions.find((region) => region.id === selectedRegionId) ??
			null,
		[definition.regions, selectedRegionId],
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code === "Space") setSpacePressed(true);
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.code === "Space") setSpacePressed(false);
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
		};
	}, []);

	const handlePointerDown = useCallback((event: PointerEvent) => {
		if (event.button !== 0 && event.button !== 1) return;

		const target = event.target as Element;
		const regionId = target.getAttribute("data-io-region");
		const handle = target.getAttribute("data-io-handle") as ResizeCorner | null;
		const currentTool = toolRef.current;

		if (spacePressedRef.current || event.button === 1) {
			dragRef.current = {
				type: "pan",
				startClientX: event.clientX,
				startClientY: event.clientY,
				originX: panXRef.current,
				originY: panYRef.current,
			};
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
			return;
		}

		// Selection happens before getPoint guard so it works
		// even when image hasn't loaded (zero-size container).
		if (regionId) {
			onSelectRegionRef.current(regionId);

			// In draw mode, clicking a region/handle enters select mode,
			// but does not start move/resize in the same pointer interaction.
			if (currentTool !== "select") {
				onToolChangeRef.current?.("select");
				return;
			}
		} else if (!handle && currentTool === "select") {
			onSelectRegionRef.current(null);
		}

		const point = getPoint(event, mediaRef.current);
		if (!point) return;

		if (handle && regionId) {
			dragRef.current = { type: "resize", regionId, corner: handle };
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
			return;
		}

		if (regionId) {
			if (currentTool === "select") {
				const region = definitionRef.current.regions.find(
					(r) => r.id === regionId,
				);
				if (!region) return;
				dragRef.current = {
					type: "move",
					regionId,
					offsetX: point.x - region.x,
					offsetY: point.y - region.y,
				};
				(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
			}
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
	}, []);

	const handlePointerMove = useCallback((event: PointerEvent) => {
		const drag = dragRef.current;
		if (!drag) return;

		if (drag.type === "pan") {
			const dx = event.clientX - drag.startClientX;
			const dy = event.clientY - drag.startClientY;
			onPanChangeRef.current(drag.originX + dx, drag.originY + dy);
			return;
		}

		const point = getPoint(event, mediaRef.current);
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

		const def = definitionRef.current;
		if (drag.type === "move") {
			onDefinitionChangeRef.current(
				updateRegion(def, drag.regionId, (region) => ({
					...region,
					...buildMoveUpdate(region, point, {
						x: drag.offsetX,
						y: drag.offsetY,
					}),
				})),
			);
			return;
		}

		// resize
		onDefinitionChangeRef.current(
			updateRegion(def, drag.regionId, (region) => ({
				...region,
				...buildResizeUpdate(region, drag.corner, point),
			})),
		);
	}, []);

	const handlePointerUp = useCallback(() => {
		const drag = dragRef.current;
		if (!drag) return;

		if (drag.type === "draw") {
			const draft = draftRegionRef.current;
			if (draft) {
				const result = commitDraftRegion(definitionRef.current, draft);
				if (result) {
					onDefinitionChangeRef.current(result.definition);
					onSelectRegionRef.current(result.regionId);
				}
			}
		}

		dragRef.current = null;
		setDraftRegion(null);
	}, []);

	const handleLostPointerCapture = useCallback(() => {
		// Safety net: if capture is released unexpectedly, clean up drag state
		if (dragRef.current) {
			dragRef.current = null;
			setDraftRegion(null);
		}
	}, []);

	const handleWheel = (event: WheelEvent) => {
		event.preventDefault();
		const multiplier = event.deltaY < 0 ? 1.12 : 0.88;
		onZoomChange(clamp(zoom * multiplier, 0.5, 4));
	};

	if (!imageUrl) {
		return (
			<div class="true-recall-io-canvas-empty">
				Select or paste an image to start drawing masks.
			</div>
		);
	}

	const allRegions = draftRegion
		? [...definition.regions, draftRegion]
		: definition.regions;

	return (
		<div class="true-recall-io-canvas-wrap">
			<div
				class={`true-recall-io-canvas-stage tool-${tool} ${spacePressed ? "is-panning" : ""}`}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onLostPointerCapture={handleLostPointerCapture}
				onWheel={handleWheel}
			>
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
						onClick={() => {
							onZoomChange(1);
							onPanChange(0, 0);
						}}
					/>
				</div>
				<div class="true-recall-io-canvas-shortcuts" title="Editor shortcuts">
					<kbd>Space + drag</kbd> pan
				</div>
				<div
					class="true-recall-io-canvas-transform"
					style={{
						transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
					}}
				>
					<div ref={mediaRefCallback} class="true-recall-io-canvas-media">
						<img
							src={imageUrl}
							alt="Occlusion source"
							draggable={false}
							class="true-recall-io-canvas-image"
						/>
						<svg
							class="true-recall-io-canvas-svg"
							viewBox="0 0 1 1"
							preserveAspectRatio="none"
							aria-hidden="true"
						>
							{allRegions.map((region) => {
								const isSelected = selectedRegionId === region.id;
								const commonProps = {
									"data-io-region": region.id,
									class: `true-recall-io-canvas-region ${isSelected ? "is-selected" : ""} ${region.id === "draft" ? "is-draft" : ""}`,
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
							})}

							{selectedRegion &&
								(["nw", "ne", "sw", "se"] as const).map((corner) => {
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
								})}
						</svg>
					</div>
				</div>
			</div>
		</div>
	);
}
