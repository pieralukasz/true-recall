import { useCallback, useRef } from "preact/hooks";

export function useScrollPreservation() {
	const contentRef = useRef<HTMLDivElement>(null);

	const preserveScroll = useCallback((action: () => void): void => {
		const pos = contentRef.current?.scrollTop ?? 0;
		action();
		window.requestAnimationFrame(() => {
			if (contentRef.current) contentRef.current.scrollTop = pos;
		});
	}, []);

	const captureScroll = useCallback((): (() => void) => {
		const pos = contentRef.current?.scrollTop ?? 0;
		return () => {
			window.requestAnimationFrame(() => {
				if (contentRef.current) contentRef.current.scrollTop = pos;
			});
		};
	}, []);

	return { contentRef, preserveScroll, captureScroll };
}
