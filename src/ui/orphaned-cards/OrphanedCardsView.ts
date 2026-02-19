import { signal } from "@preact/signals";
import { ItemView, type Menu, Platform, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";
import { VIEW_TYPE_ORPHANED_CARDS } from "../../constants";
import type TrueRecallPlugin from "../../main";
import { mountPreact } from "../preact";
import { OrphanedCardsApp } from "./OrphanedCardsApp";

export class OrphanedCardsView extends ItemView {
	private plugin: TrueRecallPlugin;
	private unmountPreact?: () => void;
	private refreshSignal = signal(0);

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ORPHANED_CARDS;
	}

	getDisplayText(): string {
		return "Orphaned cards";
	}

	getIcon(): string {
		return "trash-2";
	}

	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);

		if (!Platform.isMobile) return;

		menu.addItem((item) => {
			item
				.setTitle("Refresh")
				.setIcon("refresh-cw")
				.onClick(() => this.refresh());
		});
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();

		if (!Platform.isMobile) {
			this.addAction("refresh-cw", "Refresh", () => this.refresh());
		}

		this.unmountPreact = mountPreact(
			container,
			this.plugin,
			h(OrphanedCardsApp, { refreshSignal: this.refreshSignal }),
		);
	}

	async onClose(): Promise<void> {
		this.unmountPreact?.();
		this.unmountPreact = undefined;
	}

	refresh(): void {
		this.refreshSignal.value++;
	}
}
