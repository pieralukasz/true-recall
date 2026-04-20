import { Menu, Notice } from "obsidian";

import {
	type CardAIPreset,
	CardAIRunner,
	CardAIService,
	type CardAITarget,
	OpenRouterClient,
} from "@true-recall/core";
import {
	type AIClientConfig,
	resolveAIClientConfig,
} from "@true-recall/core/ai/config/ai-client-config";

import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";
import { promptText } from "@true-recall/obsidian/modals/shared/TextInputModal";

import type { PluginContext } from "../types";
import { handleCardAIError } from "./card-ai-error-handler";
import { createObsidianContextCollector } from "./createObsidianContextCollector";
import { ObsidianCardAIPresenter } from "./ObsidianCardAIPresenter";

export interface CardAIBaseEventDetail {
	kind: string;
	anchor: HTMLElement;
}

export interface CardAIPluginBaseConfig<TDetail extends CardAIBaseEventDetail> {
	eventName: string;
	bucketKey: "cardPolish" | "flashcardGeneration";
	builtins: CardAIPreset[];
	capabilityTag: string;
	/** Returns null to abort the menu (e.g. missing required state). */
	buildTarget: (detail: TDetail) => CardAITarget | null;
}

export abstract class CardAIPluginBase<TDetail extends CardAIBaseEventDetail> {
	private listener: ((e: Event) => void) | null = null;
	private abortController: AbortController | null = null;

	constructor(
		protected readonly ctx: PluginContext,
		private readonly config: CardAIPluginBaseConfig<TDetail>,
	) {}

	activate(): void {
		this.listener = (e: Event) => {
			const ev = e as CustomEvent<TDetail>;
			if (!ev.detail) return;
			this.openMenu(ev.detail);
		};
		window.addEventListener(this.config.eventName, this.listener);
	}

	deactivate(): void {
		if (this.listener) {
			window.removeEventListener(this.config.eventName, this.listener);
			this.listener = null;
		}
		this.abortController?.abort();
		this.abortController = null;
	}

	protected getPresets(): CardAIPreset[] {
		const userBucket = this.ctx.settings[this.config.bucketKey];
		const user = userBucket?.userPresets ?? [];
		const isPro = !!this.ctx.settings.proKey;
		const builtins = this.config.builtins.filter(
			(p) => !p.requiresPro || isPro,
		);
		return [...builtins, ...user];
	}

	private openMenu(detail: TDetail): void {
		const presets = this.getPresets();
		const menu = new Menu();
		for (const preset of presets) {
			menu.addItem((item) =>
				item
					.setTitle(preset.name)
					.setIcon(preset.autoApply ? "zap" : "eye")
					.onClick(() => void this.runPreset(preset, detail)),
			);
		}
		if (presets.length > 0) menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle("Custom…")
				.setIcon("pencil")
				.onClick(() => void this.promptCustom(detail)),
		);

		const rect = detail.anchor.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.top });
		const menuEl = (menu as unknown as { dom?: HTMLElement }).dom;
		if (menuEl) {
			requestAnimationFrame(() => {
				menuEl.style.top = `${Math.max(8, rect.top - menuEl.offsetHeight - 6)}px`;
			});
		}
	}

	private buildService(modelOverride?: string): CardAIService | null {
		let config: AIClientConfig;
		try {
			config = resolveAIClientConfig(this.ctx.settings);
		} catch {
			new Notice(
				"AI: configure your Pro key or OpenRouter API key in Settings.",
			);
			return null;
		}
		const model =
			!config.hasProTier && modelOverride ? modelOverride : config.model;
		const httpClient = new ObsidianHttpClient();
		const client = new OpenRouterClient(
			config.apiKey,
			model,
			httpClient,
			config.baseUrl,
			undefined,
			this.config.capabilityTag,
		);
		return new CardAIService(client);
	}

	protected async runPreset(
		preset: CardAIPreset,
		detail: TDetail,
	): Promise<void> {
		const target = this.config.buildTarget(detail);
		if (!target) return;
		const service = this.buildService(preset.modelOverride);
		if (!service) return;

		this.abortController?.abort();
		const controller = new AbortController();
		this.abortController = controller;

		const esc = (e: KeyboardEvent) => {
			if (e.key === "Escape") controller.abort();
		};
		document.addEventListener("keydown", esc, true);
		const notice = new Notice("Generating… (Esc to cancel)", 0);

		try {
			const collector = createObsidianContextCollector(this.ctx.obsidianPlugin);
			const presenter = new ObsidianCardAIPresenter(this.ctx.app);
			const runner = new CardAIRunner(target, service, collector, presenter);
			await runner.run(preset, controller.signal);
		} catch (err) {
			handleCardAIError(err, { onRawFallback: () => undefined });
		} finally {
			notice.hide();
			document.removeEventListener("keydown", esc, true);
			if (this.abortController === controller) this.abortController = null;
		}
	}

	private async promptCustom(detail: TDetail): Promise<void> {
		const instruction = await promptText(this.ctx.app, {
			title: "Custom AI instruction",
			label: "Instruction",
			placeholder: "e.g. Polish formatting and fill empty fields",
		});
		if (!instruction) return;
		const autoApply =
			this.ctx.settings[this.config.bucketKey]?.customPromptAutoApply ?? false;
		await this.runPreset(
			{
				id: "__custom__",
				name: "Custom",
				prompt: instruction,
				autoApply,
				builtin: false,
			},
			detail,
		);
	}
}
