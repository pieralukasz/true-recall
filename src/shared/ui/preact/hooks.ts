import { useApp } from "@shared/ui/preact/ObsidianContext";
import {
	MarkdownRenderer,
	Component as ObsidianComponent,
	setIcon,
} from "obsidian";
import { useEffect, useRef } from "preact/hooks";

export function useMarkdown(
	markdown: string,
	sourcePath = "",
): preact.RefObject<HTMLDivElement> {
	const app = useApp();
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		el.empty();
		const obsComponent = new ObsidianComponent();
		MarkdownRenderer.render(app, markdown, el, sourcePath, obsComponent);

		return () => obsComponent.unload();
	}, [app, markdown, sourcePath]);

	return ref;
}

export function useIcon(iconId: string): preact.RefObject<HTMLDivElement> {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (ref.current) {
			setIcon(ref.current, iconId);
		}
	}, [iconId]);

	return ref;
}
