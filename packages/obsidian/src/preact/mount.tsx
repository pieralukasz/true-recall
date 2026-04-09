import { type ComponentChildren, render } from "preact";

import { ErrorBoundary } from "@true-recall/obsidian/components/ErrorBoundary";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";

import type TrueRecallPlugin from "../main";

export function mountPreact(
	container: HTMLElement,
	plugin: TrueRecallPlugin,
	children: ComponentChildren,
): () => void {
	render(
		<ObsidianProvider value={{ app: plugin.app, plugin }}>
			<ErrorBoundary>{children}</ErrorBoundary>
		</ObsidianProvider>,
		container,
	);
	return () => render(null, container);
}
