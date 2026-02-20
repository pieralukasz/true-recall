import { CardBrowserApp } from "@features/library/ui/browser/CardBrowserApp";
import { VIEW_TYPE_CARD_BROWSER } from "@shared/constants";
import { mountPreact } from "@shared/ui/preact";
import { ItemView, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";
import type TrueRecallPlugin from "../../../../main";

export class CardBrowserView extends ItemView {
	private plugin: TrueRecallPlugin;
	private unmountPreact?: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_CARD_BROWSER;
	}

	getDisplayText(): string {
		return "Card browser";
	}

	getIcon(): string {
		return "table-2";
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
			h(CardBrowserApp, null),
		);
	}

	async onClose(): Promise<void> {
		this.unmountPreact?.();
		this.unmountPreact = undefined;
	}
}
