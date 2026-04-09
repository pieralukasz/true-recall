import { useCallback, useMemo, useState } from "preact/hooks";

import { clamp } from "@true-recall/core/utils/canvas-geometry";
import { parseIODefinition } from "@true-recall/core/utils/io-definition";

import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";

import { resolveImageFile } from "./resolve-image";
import type { IORegion } from "./types";

export interface IOCardRendererProps {
	imagePath?: string;
	regionsJson?: string;
	templateOrd?: number;
	revealed: boolean;
	class?: string;
	maskModeOverride?: "solo" | "all";
	revealSingleOnly?: boolean;
	expandable?: boolean;
	onRegionClick?: (ord: number) => void;
}

interface RegionRenderInfo {
	region: IORegion;
	ord: number;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function parseGroupOrd(region: IORegion, fallbackOrd: number): number {
	const parsed = Number.parseInt(region.groupKey, 10);
	if (Number.isFinite(parsed) && parsed >= 0) {
		return parsed;
	}
	return fallbackOrd;
}

function getRegionClass(
	info: RegionRenderInfo,
	activeOrd: number,
	revealed: boolean,
	maskMode: "solo" | "all",
	revealSingleOnly = false,
): string {
	const isActive = info.ord === activeOrd;
	if (revealed) {
		if (isActive) return "is-revealed-active";
		if (revealSingleOnly) {
			return maskMode === "all" ? "is-mask-passive" : "is-outline-passive";
		}
		return "is-revealed-passive";
	}
	if (maskMode === "all") {
		return isActive ? "is-mask-active" : "is-mask-passive";
	}
	return isActive ? "is-mask-active" : "is-outline-passive";
}

export function IOCardRenderer({
	imagePath,
	regionsJson,
	templateOrd = 0,
	revealed,
	class: className,
	maskModeOverride,
	revealSingleOnly,
	expandable,
	onRegionClick,
}: IOCardRendererProps) {
	const app = useApp();

	const definition = useMemo(
		() => parseIODefinition(regionsJson ?? ""),
		[regionsJson],
	);

	const imageFile = useMemo(
		() => (imagePath ? resolveImageFile(app, imagePath) : null),
		[app, imagePath],
	);

	const renderRegions = useMemo<RegionRenderInfo[]>(() => {
		if (!definition) return [];
		return definition.regions.map((region, index) => ({
			region,
			ord: parseGroupOrd(region, index),
		}));
	}, [definition]);

	const [aspectRatio, setAspectRatio] = useState<number | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [zoom, setZoom] = useState(1);

	const expandIconRef = useIcon(expanded ? "minimize-2" : "maximize-2");

	const handleImageLoad = useCallback((e: Event) => {
		const img = e.currentTarget as HTMLImageElement;
		if (img.naturalWidth > 0 && img.naturalHeight > 0) {
			setAspectRatio(img.naturalWidth / img.naturalHeight);
		}
		setLoaded(true);
	}, []);

	const handleImageError = useCallback(() => {
		setLoaded(true);
	}, []);

	const handleToggleExpand = useCallback(() => {
		setExpanded((prev) => {
			if (prev) setZoom(1);
			return !prev;
		});
	}, []);

	const handleWheel = useCallback(
		(e: WheelEvent) => {
			if (!expanded) return;
			e.preventDefault();
			const multiplier = e.deltaY < 0 ? 1.12 : 0.88;
			setZoom((z) => clamp(z * multiplier, MIN_ZOOM, MAX_ZOOM));
		},
		[expanded],
	);

	if (!imageFile || !definition) {
		return (
			<div class={`true-recall-io-fallback ${className ?? ""}`}>
				Image occlusion data unavailable
			</div>
		);
	}

	const imageUrl = app.vault.getResourcePath(imageFile);
	const isZoomed = zoom !== 1;
	const renderClasses = [
		"true-recall-io-render",
		revealed && "is-revealed",
		expanded && "is-expanded",
		className,
	]
		.filter(Boolean)
		.join(" ");

	const frameClasses = [
		"true-recall-io-render-frame",
		loaded && "is-loaded",
		expanded && "is-expanded",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div class={renderClasses}>
			<div
				class={frameClasses}
				style={aspectRatio ? { aspectRatio: `${aspectRatio}` } : undefined}
				onWheel={handleWheel}
			>
				{expandable && (
					<button
						type="button"
						class="true-recall-io-expand-btn"
						aria-label={expanded ? "Collapse image" : "Expand image"}
						onClick={handleToggleExpand}
					>
						<span ref={expandIconRef} />
					</button>
				)}
				<div
					class="true-recall-io-render-zoom-wrapper"
					style={
						isZoomed
							? {
									transform: `scale(${zoom})`,
									transformOrigin: "center center",
								}
							: undefined
					}
				>
					<img
						src={imageUrl}
						alt={`Occlusion ${templateOrd + 1}`}
						class="true-recall-io-render-image"
						onLoad={handleImageLoad}
						onError={handleImageError}
					/>
					<svg
						class="true-recall-io-render-svg"
						viewBox="0 0 1 1"
						preserveAspectRatio="none"
						aria-hidden="true"
					>
						{renderRegions.map((info) => {
							const shapeClass = `true-recall-io-shape ${getRegionClass(
								info,
								templateOrd,
								revealed,
								maskModeOverride ?? definition.maskMode,
								revealSingleOnly,
							)}${onRegionClick ? " true-recall-io-shape-clickable" : ""}`;

							if (info.region.shape === "ellipse") {
								return (
									<ellipse
										key={info.region.id}
										class={shapeClass}
										cx={info.region.x + info.region.w / 2}
										cy={info.region.y + info.region.h / 2}
										rx={info.region.w / 2}
										ry={info.region.h / 2}
										{...(onRegionClick
											? {
													onClick: (e: Event) => {
														e.stopPropagation();
														onRegionClick(info.ord);
													},
													role: "button",
													tabIndex: 0,
												}
											: {})}
									/>
								);
							}

							return (
								<rect
									key={info.region.id}
									class={shapeClass}
									x={info.region.x}
									y={info.region.y}
									width={info.region.w}
									height={info.region.h}
									rx={0.01}
									ry={0.01}
									{...(onRegionClick
										? {
												onClick: (e: Event) => {
													e.stopPropagation();
													onRegionClick(info.ord);
												},
												role: "button",
												tabIndex: 0,
											}
										: {})}
								/>
							);
						})}
					</svg>
				</div>
				{expandable && isZoomed && (
					<span class="true-recall-io-zoom-indicator">
						{Math.round(zoom * 100)}%
					</span>
				)}
			</div>
		</div>
	);
}
