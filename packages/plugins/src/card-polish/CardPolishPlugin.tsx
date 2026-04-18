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
	private menuKeyListener: ((e: KeyboardEvent) => void) | null = null;
	private menuClickListener: ((e: PointerEvent) => void) | null = null;

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
				if (this.menuContainer?.firstElementChild !== menuEl) return;
				menuEl.style.left = `${x}px`;
				menuEl.style.top = `${y}px`;
				menuEl.style.position = "absolute";
			});
		}

		this.menuKeyListener = (e: KeyboardEvent) => {
			if (e.key === "Escape") this.closeMenu();
		};
		this.menuClickListener = (e: PointerEvent) => {
			const target = e.target as Node | null;
			if (!target) return;
			if (this.menuContainer?.contains(target)) return;
			if (anchor.contains(target)) return;
			this.closeMenu();
		};
		// Schedule listener install after the current event loop tick so the
		// click that opened the menu doesn't immediately close it.
		window.setTimeout(() => {
			if (!this.menuContainer) return;
			if (this.menuKeyListener) {
				document.addEventListener("keydown", this.menuKeyListener);
			}
			if (this.menuClickListener) {
				document.addEventListener(
					"pointerdown",
					this.menuClickListener,
					true,
				);
			}
		}, 0);
	}

	private closeMenu(): void {
		if (this.menuKeyListener) {
			document.removeEventListener("keydown", this.menuKeyListener);
			this.menuKeyListener = null;
		}
		if (this.menuClickListener) {
			document.removeEventListener(
				"pointerdown",
				this.menuClickListener,
				true,
			);
			this.menuClickListener = null;
		}
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
