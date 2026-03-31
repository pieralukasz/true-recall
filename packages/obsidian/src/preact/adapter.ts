import type { TrueRecallContext } from "@true-recall/ui/context";
import {
	MarkdownRenderer,
	Component as ObsidianComponent,
	Platform,
	setIcon,
} from "obsidian";
import type TrueRecallPlugin from "../main";

export function createTrueRecallAdapter(
	plugin: TrueRecallPlugin,
): TrueRecallContext {
	return {
		core: plugin,
		navigate: {
			openFile: (path) => void plugin.app.workspace.openLinkText(path, ""),
			startReview: (opts) =>
				void plugin.startReview(
					(opts as unknown as import("@true-recall/core/types/session-config.types").SessionConfig) ?? {
						mode: "all_due",
					},
				),
			openDashboard: () => void plugin.openDashboard(),
			openCardBrowser: (query) => void plugin.openCardBrowser(query),
			openModal: () => {},
		},
		render: {
			markdown: (md, el) => {
				const comp = new ObsidianComponent();
				void MarkdownRenderer.render(plugin.app, md, el, "", comp);
			},
			icon: (el, id) => {
				setIcon(el, id);
			},
		},
		platform: {
			isMobile: Platform.isMobile,
		},
	};
}
