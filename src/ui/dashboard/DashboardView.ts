/**
 * Dashboard View
 * Panel-based view for command dashboard
 */
import { ItemView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_DASHBOARD } from "../../constants";
import { DashboardHeader } from "./DashboardHeader";
import { DashboardContent } from "./DashboardContent";
import type EpistemePlugin from "../../main";

/**
 * Dashboard View
 * Panel-based version of CommandDashboardModal
 */
export class DashboardView extends ItemView {
	private plugin: EpistemePlugin;

	// UI Components
	private headerComponent: DashboardHeader | null = null;
	private contentComponent: DashboardContent | null = null;

	// Container elements
	private headerContainer!: HTMLElement;
	private contentContainer!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: EpistemePlugin) {
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
		container.addClass("episteme-dashboard-view");

		// Create container elements
		this.headerContainer = container.createDiv({
			cls: "episteme-dashboard-header-container",
		});
		this.contentContainer = container.createDiv({
			cls: "episteme-dashboard-content-container",
		});

		// Render
		this.render();
	}

	async onClose(): Promise<void> {
		this.headerComponent?.destroy();
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
	 * Render all components
	 */
	private render(): void {
		// Render Header
		this.headerComponent?.destroy();
		this.headerContainer.empty();
		this.headerComponent = new DashboardHeader(this.headerContainer);
		this.headerComponent.render();

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
