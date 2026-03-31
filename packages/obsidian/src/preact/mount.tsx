import { ObsidianProvider } from "@true-recall/obsidian/preact/ObsidianContext";
import { TrueRecallProvider } from "@true-recall/ui/context";
import { ErrorBoundary } from "@true-recall/ui/shared";
import { type ComponentChildren, render } from "preact";
import type TrueRecallPlugin from "../main";
import { createTrueRecallAdapter } from "./adapter";

export function mountPreact(
	container: HTMLElement,
	plugin: TrueRecallPlugin,
	children: ComponentChildren,
): () => void {
	const adapter = createTrueRecallAdapter(plugin);
	render(
		<ObsidianProvider value={{ app: plugin.app, plugin }}>
			<TrueRecallProvider value={adapter}>
				<ErrorBoundary>{children}</ErrorBoundary>
			</TrueRecallProvider>
		</ObsidianProvider>,
		container,
	);
	return () => render(null, container);
}
