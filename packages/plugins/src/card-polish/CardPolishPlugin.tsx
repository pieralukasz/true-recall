import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import type { EventRef } from "obsidian";
import { render } from "preact";

import type { CardPolishPreset } from "@true-recall/core";
import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";

import type { PluginContext } from "../types";
import { DEFAULT_CARD_POLISH_SETTINGS } from "./default-presets";
import { PolishButton } from "./PolishButton";
import { PolishMenu } from "./PolishMenu";

export class CardPolishPlugin {
	private container: HTMLDivElement | null = null;
	private menuContainer: HTMLDivElement | null = null;
	private leafObserverRef: EventRef | null = null;

	constructor(private readonly ctx: PluginContext) {}

	activate(): void {
		this.leafObserverRef = this.ctx.workspace.on("active-leaf-change", () => {
			this.syncMount();
		});
		this.syncMount();
	}

	deactivate(): void {
		if (this.leafObserverRef) {
			this.ctx.workspace.offref(this.leafObserverRef);
			this.leafObserverRef = null;
		}
		this.closeMenu();
		this.unmount();
	}

	private syncMount(): void {
		const leaf = this.ctx.workspace.getLeavesOfType(VIEW_TYPE_REVIEW)[0];
		if (!leaf) {
			this.unmount();
			return;
		}
		const viewEl = leaf.view.containerEl;
		if (this.container && this.container.parentElement !== viewEl) {
			this.unmount();
		}
		if (!this.container) {
			this.container = document.createElement("div");
			this.container.className = "tr-card-polish-mount";
			viewEl.appendChild(this.container);
		}
		render(
			<PolishButton onClick={(anchor) => this.openMenu(anchor)} />,
			this.container,
		);
	}

	private unmount(): void {
		if (!this.container) return;
		render(null, this.container);
		this.container.remove();
		this.container = null;
	}

	private openMenu(anchor: HTMLElement): void {
		this.closeMenu();
		this.menuContainer = document.createElement("div");
		document.body.appendChild(this.menuContainer);
		const presets = this.readSettings().presets;
		render(
			<PolishMenu
				presets={presets}
				onPreset={(p) => this.runPreset(p)}
				onCustom={() => this.openCustomPrompt(anchor)}
				onClose={() => this.closeMenu()}
			/>,
			this.menuContainer,
		);
		const menuEl = this.menuContainer.firstElementChild as HTMLElement | null;
		if (menuEl) {
			void computePosition(anchor, menuEl, {
				placement: "bottom-end",
				middleware: [offset(6), flip(), shift({ padding: 8 })],
			}).then(({ x, y }) => {
				menuEl.style.left = `${x}px`;
				menuEl.style.top = `${y}px`;
				menuEl.style.position = "absolute";
			});
		}
	}

	private closeMenu(): void {
		if (!this.menuContainer) return;
		render(null, this.menuContainer);
		this.menuContainer.remove();
		this.menuContainer = null;
	}

	private readSettings() {
		return this.ctx.settings.cardPolish ?? DEFAULT_CARD_POLISH_SETTINGS;
	}

	private runPreset(_preset: CardPolishPreset): void {
		// Task 7 implements this.
		this.closeMenu();
	}

	private openCustomPrompt(_anchor: HTMLElement): void {
		// Task 9 implements this.
		this.closeMenu();
	}
}
