/**
 * Dashboard View
 * Panel-based view for command dashboard
 */
import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_DASHBOARD } from "../../constants";
import { DashboardContent } from "./DashboardContent";
import type TrueRecallPlugin from "../../main";

/**
 * Dashboard View
 * Panel-based version of CommandDashboardModal
 * Uses native Obsidian header (no custom header needed)
 */
export class DashboardView extends ItemView {
	private plugin: TrueRecallPlugin;

	// UI Components
	private contentComponent: DashboardContent | null = null;

	// Container element
	private contentContainer!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: TrueRecallPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_DASHBOARD;
	}

	getDisplayText(): string {
		return "Dashboard";
	}

	getIcon(): string {
		return "blocks";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		if (!(container instanceof HTMLElement)) return;
		container.empty();
		container.addClass("ep:p-2");

		// Create content container
		this.contentContainer = container.createDiv({
			cls: "ep:flex-1",
		});

		// Render
		this.render();
	}

	async onClose(): Promise<void> {
		this.contentComponent?.destroy();
	}

	/**
	 * Close the view
	 */
	private closeView(): void {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_DASHBOARD);
		for (const leaf of leaves) {
			leaf.detach();
		}
	}

	/**
	 * Render content (native header shows title automatically)
	 */
	private render(): void {
		// Render Content
		this.contentComponent?.destroy();
		this.contentContainer.empty();
		this.contentComponent = new DashboardContent(this.contentContainer, {
			plugin: this.plugin,
			onCommandExecuted: () => this.closeView(),
		});
		this.contentComponent.render();
	}
}
