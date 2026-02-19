import { render, type ComponentChildren } from "preact";
import { ObsidianProvider } from "./ObsidianContext";
import type TrueRecallPlugin from "../../main";

export function mountPreact(
	container: HTMLElement,
	plugin: TrueRecallPlugin,
	children: ComponentChildren,
): () => void {
	render(
		<ObsidianProvider value={{ app: plugin.app, plugin }}>
			{children}
		</ObsidianProvider>,
		container,
	);
	return () => render(null, container);
}
