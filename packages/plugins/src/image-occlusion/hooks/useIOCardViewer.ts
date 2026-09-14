import { useCallback, useState } from "preact/hooks";

import { clamp } from "@true-recall/core/utils/canvas-geometry";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface ImageMetrics {
	source: string;
	aspectRatio: number | null;
}

export function useIOCardViewer(imageUrl: string) {
	const [imageMetrics, setImageMetrics] = useState<ImageMetrics | null>(null);
	const [expanded, setExpanded] = useState(false);
	const [zoom, setZoom] = useState(1);
	const loaded = imageMetrics?.source === imageUrl;

	const handleImageLoad = useCallback(
		(event: Event) => {
			const image = event.currentTarget as HTMLImageElement;
			const aspectRatio =
				image.naturalWidth > 0 && image.naturalHeight > 0
					? image.naturalWidth / image.naturalHeight
					: null;
			setImageMetrics({ source: imageUrl, aspectRatio });
		},
		[imageUrl],
	);

	const handleImageError = useCallback(() => {
		setImageMetrics({ source: imageUrl, aspectRatio: null });
	}, [imageUrl]);

	const toggleExpanded = useCallback(() => {
		setExpanded((current) => {
			if (current) setZoom(1);
			return !current;
		});
	}, []);

	const handleWheel = useCallback(
		(event: WheelEvent) => {
			if (!expanded) return;
			event.preventDefault();
			const multiplier = event.deltaY < 0 ? 1.12 : 0.88;
			setZoom((current) => clamp(current * multiplier, MIN_ZOOM, MAX_ZOOM));
		},
		[expanded],
	);

	return {
		aspectRatio: loaded ? imageMetrics.aspectRatio : null,
		loaded,
		expanded,
		zoom,
		isZoomed: zoom !== 1,
		handleImageLoad,
		handleImageError,
		toggleExpanded,
		handleWheel,
	};
}
