import type { RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";

const EDGE_ZONE = 50;
const MIN_SPEED = 2;
const MAX_SPEED = 10;

export function useDragAutoScroll(
	scrollContainerRef: RefObject<HTMLDivElement>,
): void {
	const rafId = useRef(0);
	const scrollDir = useRef<-1 | 0 | 1>(0);
	const scrollSpeed = useRef(0);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		function tick() {
			const el = scrollContainerRef.current;
			if (!el || scrollDir.current === 0) return;
			el.scrollTop += scrollDir.current * scrollSpeed.current;
			rafId.current = window.requestAnimationFrame(tick);
		}

		function startScroll(dir: -1 | 1, speed: number) {
			if (scrollDir.current === dir && scrollSpeed.current === speed) return;
			scrollDir.current = dir;
			scrollSpeed.current = speed;
			if (!rafId.current) {
				rafId.current = window.requestAnimationFrame(tick);
			}
		}

		function stopScroll() {
			scrollDir.current = 0;
			scrollSpeed.current = 0;
			if (rafId.current) {
				cancelAnimationFrame(rafId.current);
				rafId.current = 0;
			}
		}

		function handleDragOver(e: DragEvent) {
			const el = scrollContainerRef.current;
			if (!el) return;

			const rect = el.getBoundingClientRect();
			const y = e.clientY;

			const distFromTop = y - rect.top;
			const distFromBottom = rect.bottom - y;

			if (distFromTop < EDGE_ZONE && distFromTop >= 0) {
				// Closer to edge = faster (invert ratio)
				const ratio = 1 - distFromTop / EDGE_ZONE;
				const speed = Math.round(MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED));
				startScroll(-1, speed);
			} else if (distFromBottom < EDGE_ZONE && distFromBottom >= 0) {
				const ratio = 1 - distFromBottom / EDGE_ZONE;
				const speed = Math.round(MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED));
				startScroll(1, speed);
			} else {
				stopScroll();
			}
		}

		function handleDragEnd() {
			stopScroll();
		}

		container.addEventListener("dragover", handleDragOver);
		container.addEventListener("dragend", handleDragEnd);
		container.addEventListener("drop", handleDragEnd);

		return () => {
			stopScroll();
			container.removeEventListener("dragover", handleDragOver);
			container.removeEventListener("dragend", handleDragEnd);
			container.removeEventListener("drop", handleDragEnd);
		};
	}, [scrollContainerRef]);
}
