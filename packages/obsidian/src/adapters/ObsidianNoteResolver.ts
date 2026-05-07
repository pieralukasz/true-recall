import type { App } from "obsidian";

import type { INoteResolver } from "@true-recall/core/services";

export class ObsidianNoteResolver implements INoteResolver {
	constructor(private app: App) {}

	resolveNotePath(noteName: string): string | null {
		return (
			this.app.metadataCache.getFirstLinkpathDest(noteName, "")?.path ?? null
		);
	}
}
