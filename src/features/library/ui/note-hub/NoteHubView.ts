import { ItemView, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";
import { VIEW_TYPE_NOTE_HUB } from "../../../../shared/constants";
import type TrueRecallPlugin from "../../../../main";
import { mountPreact } from "../../../../shared/ui/preact";
import { NoteHubApp } from "./NoteHubApp";

export class NoteHubView extends ItemView {
	private plugin: TrueRecallPlugin;
	private unmountPreact?: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_NOTE_HUB;
	}

	getDisplayText(): string {
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- Feature name
		return "Note Hub";
	}

	getIcon(): string {
		return "layout-grid";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClass(
			"ep:flex",
			"ep:flex-col",
			"ep:h-full",
			"ep:overflow-hidden",
			"ep:bg-obs-primary",
		);

		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(NoteHubApp, null),
		);
	}

	async onClose(): Promise<void> {
		this.unmountPreact?.();
	}
}
