import type { EventRef } from "obsidian";
import { h, render } from "preact";

import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";

import type { PluginContext } from "../types";
import { PolishButton } from "./PolishButton";

export class CardPolishPlugin {
	private container: HTMLDivElement | null = null;
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
			h(PolishButton, {
				onClick: (anchor) => this.openMenu(anchor),
			}),
			this.container,
		);
	}

	private unmount(): void {
		if (!this.container) return;
		render(null, this.container);
		this.container.remove();
		this.container = null;
	}

	private openMenu(_anchor: HTMLElement): void {
		// Implemented in Task 6.
	}
}
