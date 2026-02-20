import {
	MarkdownRenderer,
	Component as ObsidianComponent,
} from "obsidian";
import { useCallback, useRef } from "preact/hooks";
import { useApp } from "../preact/ObsidianContext";

export interface MarkdownPreview {
	containerRef: preact.RefObject<HTMLDivElement>;
	renderMarkdown: (content: string, sourcePath?: string) => void;
	clear: () => void;
}

/**
 * Imperative markdown preview hook that manages an Obsidian Component lifecycle.
 * Unlike `useMarkdown` (which re-renders on every content change), this hook
 * exposes `renderMarkdown()` for manual control — useful in modals where
 * preview updates are triggered by explicit user actions (e.g. blur/change).
 */
export function useMarkdownPreview(): MarkdownPreview {
	const app = useApp();
	const containerRef = useRef<HTMLDivElement>(null);
	const componentRef = useRef<ObsidianComponent | null>(null);

	const clear = useCallback(() => {
		if (componentRef.current) {
			componentRef.current.unload();
			componentRef.current = null;
		}
		if (containerRef.current) containerRef.current.empty();
	}, []);

	const renderMarkdown = useCallback(
		(content: string, sourcePath = "") => {
			const el = containerRef.current;
			if (!el) return;

			clear();
			const comp = new ObsidianComponent();
			componentRef.current = comp;
			MarkdownRenderer.render(app, content, el, sourcePath, comp);
		},
		[app, clear],
	);

	return { containerRef, renderMarkdown, clear };
}
