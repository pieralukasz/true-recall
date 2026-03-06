import { parseIODefinition } from "@features/image-occlusion/io-definition";
import { resolveImageFile } from "@features/image-occlusion/resolve-image";
import type { IORegion } from "@features/image-occlusion/types";
import { useApp } from "@shared/ui/preact/ObsidianContext";
import { useCallback, useMemo, useState } from "preact/hooks";

export interface IOCardRendererProps {
	imagePath?: string;
	regionsJson?: string;
	templateOrd?: number;
	revealed: boolean;
	class?: string;
	maskModeOverride?: "solo" | "all";
	onRegionClick?: (ord: number) => void;
}

interface RegionRenderInfo {
	region: IORegion;
	ord: number;
}

function parseGroupOrd(region: IORegion, fallbackOrd: number): number {
	const parsed = Number.parseInt(region.groupKey, 10);
	if (Number.isFinite(parsed) && parsed >= 0) {
		return parsed;
	}
	return fallbackOrd;
}

function getRegionClass(info: RegionRenderInfo, activeOrd: number, revealed: boolean, maskMode: "solo" | "all"): string {
	const isActive = info.ord === activeOrd;
	if (revealed) {
		return isActive ? "is-revealed-active" : "is-revealed-passive";
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

	const handleImageLoad = useCallback((e: Event) => {
		const img = e.currentTarget as HTMLImageElement;
		if (img.naturalWidth > 0 && img.naturalHeight > 0) {
			setAspectRatio(img.naturalWidth / img.naturalHeight);
		}
	}, []);

	if (!imageFile || !definition) {
		return (
			<div class={`true-recall-io-fallback ${className ?? ""}`}>
				Image occlusion data unavailable
			</div>
		);
	}

	const imageUrl = app.vault.getResourcePath(imageFile);

	return (
		<div class={`true-recall-io-render ${revealed ? "is-revealed" : ""} ${className ?? ""}`}>
			<div
				class="true-recall-io-render-frame"
				style={aspectRatio ? { aspectRatio: `${aspectRatio}` } : undefined}
			>
				<img
					src={imageUrl}
					alt={`Image occlusion ${templateOrd + 1}`}
					class="true-recall-io-render-image"
					onLoad={handleImageLoad}
				/>
				{aspectRatio !== null && <svg
					class="true-recall-io-render-svg"
					viewBox="0 0 1 1"
					preserveAspectRatio="none"
				>
					{renderRegions.map((info) => {
						const shapeClass = `true-recall-io-shape ${getRegionClass(
							info,
							templateOrd,
							revealed,
							maskModeOverride ?? definition.maskMode,
						)}${onRegionClick ? " true-recall-io-shape-clickable" : ""}`;

						const handleShapeClick = onRegionClick
							? (e: Event) => { e.stopPropagation(); onRegionClick(info.ord); }
							: undefined;

						if (info.region.shape === "ellipse") {
							return (
								<ellipse
									key={info.region.id}
									class={shapeClass}
									cx={info.region.x + info.region.w / 2}
									cy={info.region.y + info.region.h / 2}
									rx={info.region.w / 2}
									ry={info.region.h / 2}
									onClick={handleShapeClick}
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
								onClick={handleShapeClick}
							/>
						);
					})}
				</svg>}
			</div>
		</div>
	);
}

