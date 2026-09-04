import { type ComponentChildren, render } from "preact";

import { ErrorBoundary } from "@true-recall/obsidian/components/ErrorBoundary";
import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import { useKeyboardInset } from "@true-recall/obsidian/preact/useKeyboardInset";

import type TrueRecallPlugin from "../main";

function MobileKeyboardBoundary({ children }: { children: ComponentChildren }) {
	useKeyboardInset();
	return <>{children}</>;
}

export function mountPreact(
	container: HTMLElement,
	plugin: TrueRecallPlugin,
	children: ComponentChildren,
): () => void {
	render(
		<ObsidianProvider value={{ app: plugin.app, plugin }}>
			<MobileKeyboardBoundary>
				<ErrorBoundary>{children}</ErrorBoundary>
			</MobileKeyboardBoundary>
		</ObsidianProvider>,
		container,
	);
	return () => render(null, container);
}
