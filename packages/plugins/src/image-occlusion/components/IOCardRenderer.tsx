import { useMemo } from "preact/hooks";

import { parseIODefinition } from "@true-recall/core/utils/io-definition";

import { useIcon } from "@true-recall/obsidian/preact/hooks";
import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import { cn } from "@true-recall/obsidian/utils/cn";

import { useIOCardViewer } from "../hooks/useIOCardViewer";
import { buildRenderableRegions } from "../utils/card-rendering";
import { resolveImageFile } from "../utils/resolve-image";
import { IORegionOverlay } from "./IORegionOverlay";

interface IOCardRendererProps {
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
	const imageUrl = imageFile ? app.vault.getResourcePath(imageFile) : "";
	const regions = useMemo(
		() => buildRenderableRegions(definition?.regions ?? []),
		[definition],
	);
	const viewer = useIOCardViewer(imageUrl);
	const expandIconRef = useIcon(viewer.expanded ? "minimize-2" : "maximize-2");

	if (!imageFile || !definition) {
		return (
			<div class={`true-recall-io-fallback ${className ?? ""}`}>
				Image occlusion data unavailable
			</div>
		);
	}

	return (
		<div
			class={cn(
				"true-recall-io-render",
				revealed && "is-revealed",
				viewer.expanded && "is-expanded",
				className,
			)}
		>
			<div
				class={cn(
					"true-recall-io-render-frame",
					viewer.loaded && "is-loaded",
					viewer.expanded && "is-expanded",
				)}
				style={
					viewer.aspectRatio
						? { aspectRatio: `${viewer.aspectRatio}` }
						: undefined
				}
				onWheel={viewer.handleWheel}
			>
				{expandable && (
					<button
						type="button"
						class="true-recall-io-expand-btn"
						aria-label={viewer.expanded ? "Collapse image" : "Expand image"}
						onClick={viewer.toggleExpanded}
					>
						<span ref={expandIconRef} />
					</button>
				)}
				<div
					class="true-recall-io-render-zoom-wrapper"
					style={
						viewer.isZoomed
							? {
									transform: `scale(${viewer.zoom})`,
									transformOrigin: "center center",
								}
							: undefined
					}
				>
					<img
						src={imageUrl}
						alt={`Occlusion ${templateOrd + 1}`}
						class="true-recall-io-render-image"
						onLoad={viewer.handleImageLoad}
						onError={viewer.handleImageError}
					/>
					<IORegionOverlay
						regions={regions}
						activeOrdinal={templateOrd}
						revealed={revealed}
						maskMode={maskModeOverride ?? definition.maskMode}
						revealSingleOnly={revealSingleOnly}
						hideOtherRegions={definition.hideOtherRegions}
						onRegionClick={onRegionClick}
					/>
				</div>
				{expandable && viewer.isZoomed && (
					<span class="true-recall-io-zoom-indicator">
						{Math.round(viewer.zoom * 100)}%
					</span>
				)}
			</div>
		</div>
	);
}
