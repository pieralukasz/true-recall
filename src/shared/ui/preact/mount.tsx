import { type ComponentChildren, render } from "preact";
import type TrueRecallPlugin from "../../../main";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ObsidianProvider } from "./ObsidianContext";

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
