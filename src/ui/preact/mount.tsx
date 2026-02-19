import { type ComponentChildren, render } from "preact";
import type TrueRecallPlugin from "../../main";
import { ObsidianProvider } from "./ObsidianContext";

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
