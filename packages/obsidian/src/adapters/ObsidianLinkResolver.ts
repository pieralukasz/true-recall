import type { ILinkResolver } from "@true-recall/core";
import type { App } from "obsidian";

export class ObsidianLinkResolver implements ILinkResolver {
	constructor(private app: App) {}

	resolveLink(name: string): string | null {
		return this.app.metadataCache.getFirstLinkpathDest(name, "")?.path ?? null;
	}
}
