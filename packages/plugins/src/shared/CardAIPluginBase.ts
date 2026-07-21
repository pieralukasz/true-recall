import { Notice } from "obsidian";

import { OpenRouterClient } from "@true-recall/core";
import {
	type AIClientConfig,
	resolveAIClientConfig,
} from "@true-recall/core/ai/config/ai-client-config";

import { ObsidianHttpClient } from "@true-recall/obsidian/adapters/ObsidianHttpClient";

import type { PluginContext } from "../types";
import { openCardAIPresetMenu } from "./CardAIPresetMenu";
import {
	type CardAIPreset,
	CardAIRunner,
	CardAIService,
	type CardAITarget,
} from "./card-ai";
import { handleCardAIError } from "./card-ai-error-handler";
import { createObsidianContextCollector } from "./createObsidianContextCollector";
import { ObsidianCardAIPresenter } from "./ObsidianCardAIPresenter";

export interface CardAIBaseEventDetail {
	kind: string;
	anchor: HTMLElement;
}

export interface CardAIPluginBaseConfig<TDetail extends CardAIBaseEventDetail> {
	eventName: string;
	bucketKey: "cardPolish";
	builtins: CardAIPreset[];
	capabilityTag: string;
	/** Returns null to abort the menu (e.g. review has no active card). */
	buildTarget: (detail: TDetail) => CardAITarget | null;
}

/**
 * Merges plugin-shipped built-ins with user presets, filtering out Pro-gated
 * built-ins when the user has no Pro key. Pure — no Obsidian/Preact deps.
 */
export function mergePresetsForUser(args: {
	builtins: CardAIPreset[];
	userPresets: CardAIPreset[];
	isPro: boolean;
}): CardAIPreset[] {
	const visibleBuiltins = args.builtins.filter(
		(p) => !p.requiresPro || args.isPro,
	);
	return [...visibleBuiltins, ...args.userPresets];
}

export abstract class CardAIPluginBase<TDetail extends CardAIBaseEventDetail> {
	private listener: ((e: Event) => void) | null = null;
	private abortController: AbortController | null = null;
	private disposeMenu: (() => void) | null = null;

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
		this.disposeMenu?.();
		this.disposeMenu = null;
	}

	protected getPresets(): CardAIPreset[] {
		const userBucket = this.ctx.settings[this.config.bucketKey];
		return mergePresetsForUser({
			builtins: this.config.builtins,
			userPresets: userBucket?.userPresets ?? [],
			isPro: !!this.ctx.settings.proKey,
		});
	}

	private openMenu(detail: TDetail): void {
		const presets = this.getPresets();
		this.disposeMenu?.();
		this.disposeMenu = openCardAIPresetMenu({
			anchor: detail.anchor,
			presets,
			onSelect: (preset) => {
				this.disposeMenu = null;
				void this.runPreset(preset, detail);
			},
			onCustom: (instruction) => {
				this.disposeMenu = null;
				void this.runCustom(instruction, detail);
			},
		});
	}

	private buildService(): CardAIService | null {
		let config: AIClientConfig;
		try {
			config = resolveAIClientConfig(this.ctx.settings, "card-polish");
		} catch (err) {
			console.error("[CardAI] resolveAIClientConfig failed", err);
			new Notice("AI: configure the selected provider and model in settings.");
			return null;
		}
		const httpClient = new ObsidianHttpClient();
		const client = new OpenRouterClient(
			config.apiKey,
			config.model,
			httpClient,
			config.baseUrl,
			undefined,
			this.config.capabilityTag,
			{ providerType: config.providerType },
		);
		return new CardAIService(client);
	}

	protected async runPreset(
		preset: CardAIPreset,
		detail: TDetail,
	): Promise<void> {
		const target = this.config.buildTarget(detail);
		if (!target) return;
		const service = this.buildService();
		if (!service) return;

		this.abortController?.abort();
		const controller = new AbortController();
		this.abortController = controller;

		const esc = (e: KeyboardEvent) => {
			if (e.key === "Escape") controller.abort();
		};
		activeDocument.addEventListener("keydown", esc, true);
		const notice = new Notice("Generating… (esc to cancel)", 0);

		try {
			const collector = createObsidianContextCollector(this.ctx.obsidianPlugin);
			const presenter = new ObsidianCardAIPresenter(
				this.ctx.app,
				this.ctx.obsidianPlugin,
			);
			const runner = new CardAIRunner(target, service, collector, presenter);
			await runner.run(preset, controller.signal);
		} catch (err) {
			console.error("[CardAI] run failed", err);
			handleCardAIError(err, {
				onRawFallback: () =>
					new Notice("AI: could not parse response — see console for details."),
			});
		} finally {
			notice.hide();
			activeDocument.removeEventListener("keydown", esc, true);
			if (this.abortController === controller) this.abortController = null;
		}
	}

	private async runCustom(instruction: string, detail: TDetail): Promise<void> {
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
