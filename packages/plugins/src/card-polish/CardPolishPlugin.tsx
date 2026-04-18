import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { Menu, Modal, Notice } from "obsidian";
import { render } from "preact";

import {
	type CardPolishPreset,
	CardPolishService,
	OpenRouterClient,
} from "@true-recall/core";
import {
	type AIClientConfig,
	resolveAIClientConfig,
} from "@true-recall/core/ai/config/ai-client-config";
import { VIEW_TYPE_REVIEW } from "@true-recall/core/constants";

import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";
import { UpdateCardCommand } from "@true-recall/obsidian/commands/commands/card-update.cmd";

import type { PluginContext } from "../types";
import { CustomPromptInput } from "./CustomPromptInput";
import { DEFAULT_CARD_POLISH_SETTINGS } from "./default-presets";
import { PolishPreviewModal } from "./PolishPreviewModal";
import { handlePolishError } from "./polish-error-handler";

type PolishTargetCard = { id: string; question: string; answer: string };

export class CardPolishPlugin {
	private menuContainer: HTMLDivElement | null = null;
	private polishMenuListener: ((e: Event) => void) | null = null;
	private menuKeyListener: ((e: KeyboardEvent) => void) | null = null;
	private menuClickListener: ((e: PointerEvent) => void) | null = null;
	private abortController: AbortController | null = null;
	private recentCustomPrompts: string[] = [];
	private registeredCommandIds: string[] = [];

	constructor(private readonly ctx: PluginContext) {}

	activate(): void {
		this.polishMenuListener = (e: Event) => {
			const customEvent = e as CustomEvent<{ anchor: HTMLElement }>;
			const anchor = customEvent.detail?.anchor;
			if (!(anchor instanceof HTMLElement)) return;
			this.openMenu(anchor);
		};
		window.addEventListener(
			"true-recall:card-polish-menu",
			this.polishMenuListener,
		);
		this.registerHotkeys();
	}

	deactivate(): void {
		if (this.polishMenuListener) {
			window.removeEventListener(
				"true-recall:card-polish-menu",
				this.polishMenuListener,
			);
			this.polishMenuListener = null;
		}
		this.closeMenu();
		this.abortController?.abort();
		this.abortController = null;
		this.unregisterHotkeys();
	}

	private registerHotkeys(): void {
		const presets = this.readSettings().presets;
		for (const preset of presets) {
			if (!preset.hotkey) continue;
			const id = `card-polish-${preset.id}`;
			this.ctx.obsidianPlugin.addCommand({
				id,
				name: `Polish: ${preset.name}`,
				checkCallback: (checking: boolean) => {
					const leaf = this.ctx.workspace.activeLeaf;
					const viewType = leaf?.view?.getViewType?.() ?? "";
					if (viewType !== VIEW_TYPE_REVIEW) return false;
					// When the plugin is inactive (no active listener), also return false.
					if (!this.polishMenuListener) return false;
					if (!checking) {
						void this.runPreset(preset);
					}
					return true;
				},
			});
			this.registeredCommandIds.push(id);
		}
	}

	private unregisterHotkeys(): void {
		// Obsidian does not expose a public removeCommand. Commands persist for the
		// lifetime of TrueRecallPlugin. The checkCallback above already guards against
		// running when this instance has been deactivated (this.polishMenuListener is null).
		this.registeredCommandIds = [];
	}

	private openMenu(anchor: HTMLElement): void {
		this.closeMenu();
		const presets = this.readSettings().presets;
		const menu = new Menu();

		for (const preset of presets) {
			menu.addItem((item) =>
				item
					.setTitle(preset.name)
					.setIcon(preset.autoApply ? "zap" : "eye")
					.onClick(() => void this.runPreset(preset)),
			);
		}
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Custom…")
				.setIcon("pencil")
				.onClick(() => this.openCustomPrompt(anchor)),
		);

		const rect = anchor.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.top });
		// Obsidian opens menus downward by default. Reposition above the button
		// so the menu doesn't cover review controls below.
		const menuEl = (menu as unknown as { dom?: HTMLElement }).dom;
		if (menuEl) {
			requestAnimationFrame(() => {
				const height = menuEl.offsetHeight;
				menuEl.style.top = `${Math.max(8, rect.top - height - 6)}px`;
			});
		}
	}

	private closeMenu(): void {
		if (this.menuKeyListener) {
			document.removeEventListener("keydown", this.menuKeyListener);
			this.menuKeyListener = null;
		}
		if (this.menuClickListener) {
			document.removeEventListener("pointerdown", this.menuClickListener, true);
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

	private async executePolish(params: {
		card: PolishTargetCard;
		prompt: string;
		service: CardPolishService;
		onResult: (result: { front: string; back: string }) => void;
	}): Promise<void> {
		this.abortController?.abort();
		const controller = new AbortController();
		this.abortController = controller;

		const reviewLeaf = this.ctx.workspace.getLeavesOfType(VIEW_TYPE_REVIEW)[0];
		const keyListener = (e: KeyboardEvent) => {
			if (e.key === "Escape") controller.abort();
		};
		reviewLeaf?.view.containerEl.addEventListener("keydown", keyListener);

		const notice = new Notice("Polishing…", 0);
		try {
			const result = await params.service.transform({
				cardFront: params.card.question,
				cardBack: params.card.answer,
				prompt: params.prompt,
				signal: controller.signal,
			});
			params.onResult({ front: result.front, back: result.back });
		} catch (err) {
			handlePolishError(err, {
				onRawFallback: (raw) => this.openRawFallback(raw),
			});
		} finally {
			notice.hide();
			reviewLeaf?.view.containerEl.removeEventListener("keydown", keyListener);
			if (this.abortController === controller) {
				this.abortController = null;
			}
		}
	}

	private async runPreset(preset: CardPolishPreset): Promise<void> {
		this.closeMenu();
		const card = this.getCurrentCard();
		if (!card) return;
		const service = this.buildService(preset.modelOverride);
		if (!service) return;
		await this.executePolish({
			card,
			prompt: preset.prompt,
			service,
			onResult: (result) => {
				if (preset.autoApply) {
					this.applyPolishResult(card, result);
					new Notice("Card polished");
				} else {
					this.openPreview(card, result, preset, service);
				}
			},
		});
	}

	private applyPolishResult(
		card: PolishTargetCard,
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
		let config: AIClientConfig;
		try {
			config = resolveAIClientConfig(this.ctx.settings);
		} catch {
			new Notice(
				"Card Polish: configure a Pro key or OpenRouter BYOK key in Settings.",
			);
			return null;
		}
		// Pro tier uses LiteLLM "auto" routing — modelOverride only applies to BYOK.
		const model =
			!config.hasProTier && modelOverride ? modelOverride : config.model;
		const httpClient = new ObsidianHttpClient();
		const client = new OpenRouterClient(
			config.apiKey,
			model,
			httpClient,
			config.baseUrl,
			undefined,
			"card-polish",
		);
		return new CardPolishService(client);
	}

	private getCurrentCard(): PolishTargetCard | null {
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
		card: PolishTargetCard,
		initialResult: { front: string; back: string },
		preset: CardPolishPreset,
		service: CardPolishService,
	): void {
		const modal = new Modal(this.ctx.app);
		modal.titleEl.setText("Polish preview");
		let currentProposal = initialResult;
		let isOpen = true;

		const host = modal.contentEl.createDiv();
		const mount = () => {
			render(
				<PolishPreviewModal
					original={{ front: card.question, back: card.answer }}
					proposed={currentProposal}
					onAccept={() => {
						this.applyPolishResult(card, currentProposal);
						new Notice("Card polished");
						modal.close();
					}}
					onReject={() => modal.close()}
					onRetry={async (extra: string) => {
						this.abortController?.abort();
						const controller = new AbortController();
						this.abortController = controller;
						try {
							const next = await service.transform({
								cardFront: card.question,
								cardBack: card.answer,
								prompt: `${preset.prompt}\n\nAdditional instruction: ${extra}`,
								signal: controller.signal,
							});
							if (!isOpen) return;
							currentProposal = { front: next.front, back: next.back };
							mount();
						} catch (err) {
							if (!isOpen) return;
							handlePolishError(err, {
								onRawFallback: (raw) => this.openRawFallback(raw),
							});
						} finally {
							if (this.abortController === controller) {
								this.abortController = null;
							}
						}
					}}
				/>,
				host,
			);
		};
		mount();
		modal.onClose = () => {
			isOpen = false;
			this.abortController?.abort();
			render(null, host);
		};
		modal.open();
	}

	private openRawFallback(rawResponse: string): void {
		const card = this.getCurrentCard();
		if (!card) {
			new Notice("Polish: LLM returned invalid output.");
			return;
		}
		const modal = new Modal(this.ctx.app);
		modal.titleEl.setText("Polish — raw output");
		const host = modal.contentEl.createDiv();
		render(
			<PolishPreviewModal
				original={{ front: card.question, back: card.answer }}
				proposed={null}
				rawResponse={rawResponse}
				onAccept={() => modal.close()}
				onReject={() => modal.close()}
				onRetry={async () => {
					modal.close();
				}}
			/>,
			host,
		);
		modal.onClose = () => render(null, host);
		modal.open();
	}

	private openCustomPrompt(anchor: HTMLElement): void {
		this.closeMenu();
		this.menuContainer = document.createElement("div");
		document.body.appendChild(this.menuContainer);

		const submit = (instruction: string) => {
			this.recentCustomPrompts = [
				instruction,
				...this.recentCustomPrompts.filter((x) => x !== instruction),
			].slice(0, 5);
			this.closeMenu();
			void this.runCustomPrompt(instruction);
		};

		render(
			<CustomPromptInput
				recent={this.recentCustomPrompts}
				onSubmit={submit}
				onCancel={() => this.closeMenu()}
			/>,
			this.menuContainer,
		);

		const el = this.menuContainer.firstElementChild as HTMLElement | null;
		if (el) {
			void computePosition(anchor, el, {
				placement: "top-end",
				middleware: [offset(6), flip(), shift({ padding: 8 })],
			}).then(({ x, y }) => {
				if (this.menuContainer?.firstElementChild !== el) return;
				el.style.left = `${x}px`;
				el.style.top = `${y}px`;
				el.style.position = "absolute";
			});
		}

		// Reuse the same dismissal listeners the menu uses: Escape + outside-click.
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
		window.setTimeout(() => {
			if (!this.menuContainer) return;
			if (this.menuKeyListener) {
				document.addEventListener("keydown", this.menuKeyListener);
			}
			if (this.menuClickListener) {
				document.addEventListener("pointerdown", this.menuClickListener, true);
			}
		}, 0);
	}

	private async runCustomPrompt(instruction: string): Promise<void> {
		const card = this.getCurrentCard();
		if (!card) return;
		const service = this.buildService();
		if (!service) return;
		const autoApply = this.readSettings().customPromptAutoApply;
		await this.executePolish({
			card,
			prompt: instruction,
			service,
			onResult: (result) => {
				if (autoApply) {
					this.applyPolishResult(card, result);
					new Notice("Card polished");
				} else {
					this.openPreview(
						card,
						result,
						{
							id: "__custom__",
							name: "Custom",
							prompt: instruction,
							autoApply: false,
							builtin: false,
						},
						service,
					);
				}
			},
		});
	}
}
