import { clamp, normalizePointFromRect } from "@features/image-occlusion/canvas-geometry";
import type { IODefinition, IORegion, IOShape } from "@features/image-occlusion/types";
import { Clickable } from "@shared/ui/components/Clickable";
import { useIcon } from "@shared/ui/preact/hooks";
import { getNextIOGroupKey } from "./io-definition";
import { useEffect, useMemo, useState } from "preact/hooks";

type Tool = "select" | IOShape;
type ResizeCorner = "nw" | "ne" | "sw" | "se";

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
	| {
			type: "draw";
			startX: number;
			startY: number;
			shape: IOShape;
	  }
	| {
			type: "move";
			regionId: string;
			offsetX: number;
			offsetY: number;
	  }
	| {
			type: "resize";
			regionId: string;
			corner: ResizeCorner;
	  }
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

function getRegionCorner(
	region: IORegion,
	corner: ResizeCorner,
): { x: number; y: number } {
	switch (corner) {
		case "nw":
			return { x: region.x, y: region.y };
		case "ne":
			return { x: region.x + region.w, y: region.y };
		case "sw":
			return { x: region.x, y: region.y + region.h };
		case "se":
			return { x: region.x + region.w, y: region.y + region.h };
	}
}

function updateRegion(
	definition: IODefinition,
	regionId: string,
	update: (region: IORegion) => IORegion,
): IODefinition {
	return {
		...definition,
		regions: definition.regions.map((region) =>
			region.id === regionId ? update(region) : region,
		),
	};
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
	const [mediaEl, setMediaEl] = useState<HTMLDivElement | null>(null);
	const [spacePressed, setSpacePressed] = useState(false);
	const [dragState, setDragState] = useState<DragState | null>(null);
	const [draftRegion, setDraftRegion] = useState<IORegion | null>(null);

	const selectedRegion = useMemo(
		() =>
			definition.regions.find((region) => region.id === selectedRegionId) ?? null,
		[definition.regions, selectedRegionId],
	);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code === "Space") {
				setSpacePressed(true);
			}
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.code === "Space") {
				setSpacePressed(false);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
		};
	}, []);

	useEffect(() => {
		if (!dragState) return;

		const onPointerMove = (event: PointerEvent) => {
			if (dragState.type === "pan") {
				const dx = event.clientX - dragState.startClientX;
				const dy = event.clientY - dragState.startClientY;
				onPanChange(dragState.originX + dx, dragState.originY + dy);
				return;
			}

			const point = getPoint(event, mediaEl);
			if (!point) return;

			if (dragState.type === "draw") {
				const x = Math.min(dragState.startX, point.x);
				const y = Math.min(dragState.startY, point.y);
				const w = Math.abs(point.x - dragState.startX);
				const h = Math.abs(point.y - dragState.startY);
				setDraftRegion({
					id: "draft",
					x,
					y,
					w,
					h,
					groupKey: "draft",
					shape: dragState.shape,
				});
				return;
			}

			if (dragState.type === "move") {
				onDefinitionChange(
					updateRegion(definition, dragState.regionId, (region) => {
						const nextX = clamp(point.x - dragState.offsetX, 0, 1 - region.w);
						const nextY = clamp(point.y - dragState.offsetY, 0, 1 - region.h);
						return { ...region, x: nextX, y: nextY };
					}),
				);
				return;
			}

			onDefinitionChange(
				updateRegion(definition, dragState.regionId, (region) => {
					const minSize = 0.01;
					let left = region.x;
					let top = region.y;
					let right = region.x + region.w;
					let bottom = region.y + region.h;

					if (dragState.corner === "nw") {
						left = point.x;
						top = point.y;
					} else if (dragState.corner === "ne") {
						right = point.x;
						top = point.y;
					} else if (dragState.corner === "sw") {
						left = point.x;
						bottom = point.y;
					} else {
						right = point.x;
						bottom = point.y;
					}

					left = clamp(left, 0, right - minSize);
					top = clamp(top, 0, bottom - minSize);
					right = clamp(right, left + minSize, 1);
					bottom = clamp(bottom, top + minSize, 1);

					return {
						...region,
						x: left,
						y: top,
						w: clamp(right - left, minSize, 1),
						h: clamp(bottom - top, minSize, 1),
					};
				}),
			);
		};

		const onPointerUp = () => {
			if (
				dragState.type === "draw" &&
				draftRegion &&
				draftRegion.w > 0.01 &&
				draftRegion.h > 0.01
			) {
				const region: IORegion = {
					...draftRegion,
					id: crypto.randomUUID(),
					groupKey: getNextIOGroupKey(definition),
				};
				onDefinitionChange({
					...definition,
					regions: [...definition.regions, region],
				});
				onSelectRegion(region.id);
				onToolChange?.("select");
			}

			setDragState(null);
			setDraftRegion(null);
		};

		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);

		return () => {
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		};
	}, [
		dragState,
		draftRegion,
		definition,
		onDefinitionChange,
		onPanChange,
		onSelectRegion,
		onToolChange,
		mediaEl,
	]);

	const handleWheel = (event: WheelEvent) => {
		event.preventDefault();
		const multiplier = event.deltaY < 0 ? 1.12 : 0.88;
		onZoomChange(clamp(zoom * multiplier, 0.5, 4));
	};

	const handlePointerDown = (event: PointerEvent) => {
		const target = event.target as HTMLElement;
		const regionId = target.getAttribute("data-io-region");
		const handle = target.getAttribute("data-io-handle") as ResizeCorner | null;

		if (spacePressed || event.button === 1) {
			setDragState({
				type: "pan",
				startClientX: event.clientX,
				startClientY: event.clientY,
				originX: panX,
				originY: panY,
			});
			return;
		}

		const point = getPoint(event, mediaEl);
		if (!point) return;

		if (handle && regionId) {
			setDragState({
				type: "resize",
				regionId,
				corner: handle,
			});
			return;
		}

		if (regionId) {
			onSelectRegion(regionId);
			if (tool === "select") {
				const region = definition.regions.find((item) => item.id === regionId);
				if (!region) return;
				setDragState({
					type: "move",
					regionId,
					offsetX: point.x - region.x,
					offsetY: point.y - region.y,
				});
			}
			return;
		}

		onSelectRegion(null);

		if (tool === "rect" || tool === "ellipse") {
			setDragState({
				type: "draw",
				startX: point.x,
				startY: point.y,
				shape: tool,
			});
		}
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
					<div
						ref={(el) => setMediaEl(el)}
						class="true-recall-io-canvas-media"
					>
						<img
							src={imageUrl}
							alt="Image occlusion source"
							draggable={false}
							class="true-recall-io-canvas-image"
						/>
						<svg
							class="true-recall-io-canvas-svg"
							viewBox="0 0 1 1"
							preserveAspectRatio="none"
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
											r={0.012}
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
