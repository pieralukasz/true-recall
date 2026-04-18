import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { Notice } from "obsidian";
import type { EventRef } from "obsidian";
import { render } from "preact";

import {
	AIRequestError,
	type CardPolishPreset,
	CardPolishService,
	OpenRouterClient,
	PolishAbortedError,
	PolishParseError,
	PolishProviderError,
} from "@true-recall/core";
import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";

import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";
import { UpdateCardCommand } from "@true-recall/obsidian/commands/commands/card-update.cmd";

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
	private abortController: AbortController | null = null;

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

	private async runPreset(preset: CardPolishPreset): Promise<void> {
		this.closeMenu();
		const card = this.getCurrentCard();
		if (!card) return;

		const service = this.buildService(preset.modelOverride);
		if (!service) return; // buildService shows a Notice if AI is unconfigured.

		this.abortController?.abort();
		this.abortController = new AbortController();

		const notice = new Notice("Polishing…", 0);
		try {
			const result = await service.transform({
				cardFront: card.question,
				cardBack: card.answer ?? "",
				prompt: preset.prompt,
				signal: this.abortController.signal,
			});
			notice.hide();

			if (preset.autoApply) {
				this.applyPolishResult(card, {
					front: result.front,
					back: result.back,
				});
				new Notice("Card polished");
			} else {
				this.openPreview(
					card,
					{ front: result.front, back: result.back },
					preset,
				);
			}
		} catch (err) {
			notice.hide();
			this.handlePolishError(err);
		}
	}

	private applyPolishResult(
		card: { id: string; question: string; answer: string },
		result: { front: string; back: string },
	): void {
		const plugin = this.ctx.obsidianPlugin;
		const review = plugin.store?.getState().review;
		plugin.flashcardManager.updateCardContent(
			card.id,
			result.front,
			result.back,
		);
		if (review?.getCurrentCard()?.id === card.id) {
			review.updateCurrentCardContent(result.front, result.back);
		}
		const cmd = new UpdateCardCommand(
			card.id,
			card.question,
			card.answer,
			"Polish card",
		);
		void plugin.commandService?.execute(cmd);
	}

	private buildService(modelOverride?: string): CardPolishService | null {
		const settings = this.ctx.settings;
		const key = settings.proKey ?? settings.openRouterApiKey;
		if (!key) {
			new Notice(
				"Card Polish: configure a Pro key or OpenRouter BYOK key in Settings.",
			);
			return null;
		}
		const model = modelOverride ?? settings.aiModel;
		const httpClient = new ObsidianHttpClient();
		const client = new OpenRouterClient(key, model, httpClient);
		return new CardPolishService(client);
	}

	private getCurrentCard(): {
		id: string;
		question: string;
		answer: string;
	} | null {
		const review = this.ctx.obsidianPlugin.store?.getState().review;
		const card = review?.getCurrentCard();
		if (!card) return null;
		return {
			id: card.id,
			question: card.question,
			answer: card.answer ?? "",
		};
	}

	private openPreview(
		_card: { id: string; question: string; answer: string },
		_result: { front: string; back: string },
		_preset: CardPolishPreset,
	): void {
		// Implemented in Task 8 (PolishPreviewModal).
	}

	private handlePolishError(err: unknown): void {
		if (err instanceof PolishAbortedError) return;
		if (err instanceof PolishParseError) {
			new Notice(
				"Polish: LLM returned invalid output. Try a sharper instruction via Custom.",
			);
			return;
		}
		if (err instanceof PolishProviderError) {
			const cause = err.cause;
			if (cause instanceof AIRequestError && cause.isRateLimited) {
				new Notice("Polish: rate limit hit — try again later.");
				return;
			}
			if (cause instanceof AIRequestError && cause.isUnauthorized) {
				new Notice("Polish: unauthorized — check your API key.");
				return;
			}
			new Notice(`Polish failed: ${err.message}`);
			return;
		}
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Polish failed: ${msg}`);
	}

	private openCustomPrompt(_anchor: HTMLElement): void {
		// Task 9 implements this.
		this.closeMenu();
	}
}
