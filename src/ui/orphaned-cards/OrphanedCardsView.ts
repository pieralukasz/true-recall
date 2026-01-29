/**
 * Orphaned Cards View
 * Panel for managing orphaned flashcards (cards without valid source notes)
 */
import { ItemView, WorkspaceLeaf, Platform, Menu } from "obsidian";
import { VIEW_TYPE_ORPHANED_CARDS } from "../../constants";
import { Panel } from "../components/Panel";
import { OrphanedCardsContent } from "./OrphanedCardsContent";
import type TrueRecallPlugin from "../../main";

/**
 * Orphaned Cards View
 * Panel for viewing and managing orphaned flashcards
 */
export class OrphanedCardsView extends ItemView {
	private plugin: TrueRecallPlugin;

	// UI Components
	private panelComponent: Panel | null = null;
	private contentComponent: OrphanedCardsContent | null = null;

	// Native header action elements
	private refreshAction: HTMLElement | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_ORPHANED_CARDS;
	}

	getDisplayText(): string {
		return "Orphaned Cards";
	}

	getIcon(): string {
		return "trash-2";
	}

	/**
	 * Add items to the native "..." menu (mobile)
	 */
	onPaneMenu(menu: Menu, source: string): void {
		super.onPaneMenu(menu, source);

		if (!Platform.isMobile) return;

		menu.addItem((item) => {
			item.setTitle("Refresh")
				.setIcon("refresh-cw")
				.onClick(() => this.refresh());
		});
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();

		// Create Panel component (header is native Obsidian header)
		this.panelComponent = new Panel(container, { showFooter: false });
		this.panelComponent.render();

		// Add native refresh action (desktop only - on mobile it's in "..." menu)
		if (!Platform.isMobile) {
			this.refreshAction = this.addAction("refresh-cw", "Refresh", () => {
				this.refresh();
			});
		}

		// Create content component
		const contentContainer = this.panelComponent.getContentContainer();
		if (contentContainer) {
			this.contentComponent = new OrphanedCardsContent(
				contentContainer,
				this.plugin,
				this.app
			);
			this.contentComponent.render();
		}
	}

	async onClose(): Promise<void> {
		// Cleanup
		this.contentComponent?.destroy();
		this.contentComponent = null;
		this.panelComponent = null;
		this.refreshAction = null;
	}

	/**
	 * Refresh the orphaned cards list
	 */
	refresh(): void {
		this.contentComponent?.refresh();
	}
}
