import { ErrorBoundary } from "@shared/ui/components/ErrorBoundary";
import { ObsidianProvider } from "@shared/ui/preact/ObsidianContext";
import { type ComponentChildren, render } from "preact";
import type TrueRecallPlugin from "../../../main";

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
