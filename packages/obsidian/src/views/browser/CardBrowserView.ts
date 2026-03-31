import { signal } from "@preact/signals";
import { VIEW_TYPE_CARD_BROWSER } from "@true-recall/core/constants";
import { mountPreact } from "@true-recall/obsidian/preact";
import { ItemView, type ViewStateResult, type WorkspaceLeaf } from "obsidian";
import { h } from "preact";
import type TrueRecallPlugin from "../../main";
import { CardBrowserApp } from "./CardBrowserApp";

export class CardBrowserView extends ItemView {
	private plugin: TrueRecallPlugin;
	private unmountPreact?: () => void;
	private filterSourceUid = signal<string | null>(null);
	private filterOrphaned = signal(false);

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

	onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (container instanceof HTMLElement) {
			container.empty();
			container.addClasses(["ep:h-full", "ep:overflow-hidden"]);
			this.unmountPreact = mountPreact(
				container,
				this.plugin,
				h(CardBrowserApp, {
					filterSourceUid: this.filterSourceUid,
					filterOrphaned: this.filterOrphaned,
				}),
			);
		}
		return Promise.resolve();
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const s = state as { sourceUid?: string; orphaned?: boolean } | undefined;
		if (s?.sourceUid) {
			this.filterSourceUid.value = s.sourceUid;
		}
		if (s?.orphaned) {
			this.filterOrphaned.value = true;
		}
		await super.setState(state, result);
	}

	onClose(): Promise<void> {
		this.unmountPreact?.();
		return Promise.resolve();
	}
}
