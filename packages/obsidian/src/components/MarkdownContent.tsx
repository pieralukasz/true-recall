import { useApp } from "@true-recall/obsidian/preact/ObsidianContext";
import { stripBrTags } from "@true-recall/core/utils";
import { MarkdownRenderer, Component as ObsidianComponent } from "obsidian";
import { useEffect, useRef } from "preact/hooks";

export interface MarkdownContentProps {
	markdown: string;
	filePath?: string;
	class?: string;
	onLinkClick?: (href: string) => void;
}

export function MarkdownContent({
	markdown,
	filePath = "",
	class: className,
	onLinkClick,
}: MarkdownContentProps) {
	const app = useApp();
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		el.empty();
		const obsComponent = new ObsidianComponent();
		void MarkdownRenderer.render(
			app,
			stripBrTags(markdown),
			el,
			filePath,
			obsComponent,
		);

		if (onLinkClick) {
			const handler = (e: MouseEvent) => {
				const target = e.target as HTMLElement;
				const linkEl = target.closest("a.internal-link");
				if (!linkEl) return;
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				const href = linkEl.getAttribute("data-href");
				if (href) onLinkClick(href);
			};
			el.addEventListener("click", handler, true);
			return () => {
				el.removeEventListener("click", handler, true);
				obsComponent.unload();
			};
		}

		return () => obsComponent.unload();
	}, [app, markdown, filePath, onLinkClick]);

	return <div ref={ref} class={className ?? ""} />;
}
