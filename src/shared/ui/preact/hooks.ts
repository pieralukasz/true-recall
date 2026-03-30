import { useApp } from "@shared/ui/preact/ObsidianContext";
import {
	MarkdownRenderer,
	Component as ObsidianComponent,
	setIcon,
} from "obsidian";
import { useEffect, useLayoutEffect, useRef } from "preact/hooks";

export function useMarkdown(
	markdown: string,
	sourcePath = "",
): preact.RefObject<HTMLDivElement> {
	const app = useApp();
	const ref = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const el = ref.current;
		if (!(el instanceof HTMLElement)) return;

		el.empty();
		const obsComponent = new ObsidianComponent();
		void MarkdownRenderer.render(app, markdown, el, sourcePath, obsComponent);

		return () => obsComponent.unload();
	}, [app, markdown, sourcePath]);

	return ref;
}

export function useIcon(iconId: string): preact.RefObject<HTMLDivElement> {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (ref.current instanceof HTMLElement) {
			setIcon(ref.current, iconId);
		}
	}, [iconId]);

	return ref;
}
