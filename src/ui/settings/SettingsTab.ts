import { App, PluginSettingTab, Setting } from "obsidian";
import { notify } from "../../services";
import type TrueRecallPlugin from "../../main";
import {
	DEFAULT_SETTINGS,
	AI_MODELS_EXTENDED,
	FSRS_CONFIG,
} from "../../constants";
import { DeviceSelectionModal, EasyDaysModal } from "../modals";
// HIDDEN: Copilot integration waiting for public API
// import { CopilotIntegrationService } from "../../services/integration/copilot-integration.service";
import type { AIModelKey, AIModelInfo } from "../../constants";
import type {
	TrueRecallSettings,
	ReviewViewMode,
	NewCardOrder,
	ReviewOrder,
	NewReviewMix,
} from "../../types";

// Re-export for convenience
export { DEFAULT_SETTINGS };
export type { TrueRecallSettings };

type SettingsTabId = "general" | "ai" | "scheduling" | "fsrs" | "data" | "sync";

export class TrueRecallSettingTab extends PluginSettingTab {
	plugin: TrueRecallPlugin;
	private activeTab: SettingsTabId = "general";
	private selectedPresetId: string = "";

	constructor(app: App, plugin: TrueRecallPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("ep:overflow-x-hidden");

		const tabsNav = containerEl.createDiv({
			cls: "ep:flex ep:gap-1 ep:mb-5 ep:border-b ep:border-obs-border ep:pb-2 ep:overflow-x-auto",
			attr: { role: "tablist" },
		});
		const tabs: { id: SettingsTabId; label: string }[] = [
			{ id: "general", label: "General" },
			{ id: "ai", label: "AI" },
			{ id: "scheduling", label: "Scheduling" },
			{ id: "fsrs", label: "FSRS" },
			{ id: "data", label: "Data & Backup" },
			{ id: "sync", label: "Cloud Sync" },
		];

		const tabButtons: Map<SettingsTabId, HTMLElement> = new Map();
		const tabBtnBase = "ep:py-2 ep:px-4 ep:border-none ep:bg-transparent ep:text-obs-muted ep:cursor-pointer ep:rounded-t ep:text-ui-small ep:font-medium ep:transition-colors ep:shrink-0 ep:whitespace-nowrap ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal";
		const tabBtnActive = "ep:bg-obs-interactive ep:text-obs-on-accent ep:hover:bg-obs-interactive ep:hover:text-obs-on-accent";

		tabs.forEach((tab) => {
			const isActive = this.activeTab === tab.id;
			const btn = tabsNav.createEl("button", {
				text: tab.label,
				cls: `${tabBtnBase} ${isActive ? tabBtnActive : ""}`,
				attr: {
					role: "tab",
					"aria-selected": String(isActive),
					"aria-controls": `true-recall-tabpanel-${tab.id}`,
				},
			});
			btn.dataset.tabId = tab.id;
			btn.addEventListener("click", () =>
				this.switchTab(tab.id, tabButtons, tabContents)
			);
			tabButtons.set(tab.id, btn);
		});

		const tabContents: Map<SettingsTabId, HTMLElement> = new Map();
		tabs.forEach((tab) => {
			const isActive = this.activeTab === tab.id;
			const content = containerEl.createDiv({
				cls: isActive ? "ep:block ep:animate-in ep:fade-in" : "ep:hidden",
				attr: {
					role: "tabpanel",
					id: `true-recall-tabpanel-${tab.id}`,
				},
			});
			content.dataset.tabId = tab.id;
			tabContents.set(tab.id, content);
		});

		this.renderGeneralTab(tabContents.get("general")!);
		this.renderAITab(tabContents.get("ai")!);
		this.renderSchedulingTab(tabContents.get("scheduling")!);
		this.renderFSRSTab(tabContents.get("fsrs")!);
		this.renderDataTab(tabContents.get("data")!);
		this.renderSyncTab(tabContents.get("sync")!);
	}

	private switchTab(
		tabId: SettingsTabId,
		buttons: Map<SettingsTabId, HTMLElement>,
		contents: Map<SettingsTabId, HTMLElement>
	): void {
		this.activeTab = tabId;

		const activeBtnClasses = ["ep:bg-obs-interactive", "ep:text-obs-on-accent", "ep:hover:bg-obs-interactive", "ep:hover:text-obs-on-accent"];

		buttons.forEach((btn, id) => {
			if (id === tabId) {
				activeBtnClasses.forEach(cls => btn.classList.add(cls));
				btn.setAttribute("aria-selected", "true");
			} else {
				activeBtnClasses.forEach(cls => btn.classList.remove(cls));
				btn.setAttribute("aria-selected", "false");
			}
		});

		contents.forEach((content, id) => {
			if (id === tabId) {
				content.classList.remove("ep:hidden");
				content.classList.add("ep:block");
			} else {
				content.classList.add("ep:hidden");
				content.classList.remove("ep:block");
			}
		});
	}

	private renderGeneralTab(container: HTMLElement): void {
		new Setting(container).setName("Review interface").setHeading();

		new Setting(container)
			.setName("Review mode")
			.setDesc("Where to open the review session")
			.addDropdown((dropdown) => {
				dropdown.addOption("fullscreen", "Fullscreen (main area)");
				dropdown.addOption("panel", "Side panel");
				dropdown.setValue(this.plugin.settings.reviewMode);
				dropdown.onChange(async (value) => {
					this.plugin.settings.reviewMode = value as ReviewViewMode;
					await this.plugin.saveSettings();
				});
			});

		new Setting(container)
			.setName("Show review header")
			.setDesc(
				"Display header with close button, stats and progress in review session"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showReviewHeader)
					.onChange(async (value) => {
						this.plugin.settings.showReviewHeader = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Show header stats")
			.setDesc(
				"Display new/learning/due counters in review session header"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showReviewHeaderStats)
					.onChange(async (value) => {
						this.plugin.settings.showReviewHeaderStats = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Show next review time")
			.setDesc("Display predicted interval on answer buttons")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showNextReviewTime)
					.onChange(async (value) => {
						this.plugin.settings.showNextReviewTime = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Continuous custom reviews")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- 'Next session' is a button name
			.setDesc("Show 'Next session' button after completing a custom review session")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.continuousCustomReviews)
					.onChange(async (value) => {
						this.plugin.settings.continuousCustomReviews = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container).setName("Editor integration").setHeading();

		new Setting(container)
			.setName("Show link status indicators")
			.setDesc(
				"Display inline flashcard counts (new/learning/review) next to [[links]] that point to notes with flashcards"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showLinkStatusIndicators)
					.onChange(async (value) => {
						this.plugin.settings.showLinkStatusIndicators = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Show summary banner")
			.setDesc(
				"Display an aggregate flashcard stats banner at the top of notes that contain 2+ wiki links to flashcard notes"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSummaryBanner)
					.onChange(async (value) => {
						this.plugin.settings.showSummaryBanner = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Show section summaries")
			.setDesc(
				"Display per-heading flashcard stats for sections with 2+ flashcard links"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSectionSummaries)
					.onChange(async (value) => {
						this.plugin.settings.showSectionSummaries = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container).setName("Daily limits").setHeading();

		new Setting(container)
			.setName("New cards per day")
			.setDesc("Maximum number of new cards to study each day")
			.addText((text) =>
				text
					.setPlaceholder("20")
					.setValue(String(this.plugin.settings.newCardsPerDay))
					.onChange(async (value) => {
						const num = parseInt(value) || 20;
						this.plugin.settings.newCardsPerDay = Math.max(0, num);
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Maximum reviews per day")
			.setDesc("Maximum number of reviews per day")
			.addText((text) =>
				text
					.setPlaceholder("200")
					.setValue(String(this.plugin.settings.reviewsPerDay))
					.onChange(async (value) => {
						const num = parseInt(value) || 200;
						this.plugin.settings.reviewsPerDay = Math.max(0, num);
						await this.plugin.saveSettings();
					})
			);

		new Setting(container).setName("Day boundary").setHeading();

		new Setting(container)
			.setName("Next day starts at")
			.setDesc("Hour when a new day begins (0-23). Default: 4 (4:00 am)")
			.addSlider((slider) =>
				slider
					.setLimits(0, 23, 1)
					.setValue(this.plugin.settings.dayStartHour)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.dayStartHour = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container).setName("Flashcard collection").setHeading();

		new Setting(container)
			.setName("Remove content after collecting")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- Q+A and #flashcard are technical terms
			.setDesc("Removes the entire flashcard (Q+A) from markdown after collecting. When disabled, only removes the #flashcard tag")
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.removeFlashcardContentAfterCollect
					)
					.onChange(async (value) => {
						this.plugin.settings.removeFlashcardContentAfterCollect =
							value;
						await this.plugin.saveSettings();
					})
			);

		// HIDDEN: Waiting for Copilot to expose a public API for adding notes to context.
		// The underlying code exists in CopilotIntegrationService and ReviewView.
		// Uncomment this section when Copilot adds API support.
		// See: https://github.com/logancyang/obsidian-copilot
		/*
		container.createEl("h2", { text: "Copilot Integration" });

		const copilotService = new CopilotIntegrationService(this.app);
		const isCopilotAvailable = copilotService.isAvailable();

		if (!isCopilotAvailable) {
			const warningDiv = container.createDiv({
				cls: "setting-item-description",
			});
			warningDiv.innerHTML = `
				<p style="color: var(--text-warning);">⚠️ Obsidian Copilot plugin not detected. Install and enable it to use this feature.</p>
			`;
		}

		new Setting(container)
			.setName("Auto-add source to Copilot context")
			.setDesc(
				"During review, automatically add the source note to Obsidian Copilot's context"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.copilotAutoContext)
					.setDisabled(!isCopilotAvailable)
					.onChange(async (value) => {
						this.plugin.settings.copilotAutoContext = value;
						await this.plugin.saveSettings();
					})
			);
		*/
	}

	private renderAITab(container: HTMLElement): void {
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- OpenRouter is a proper noun
		new Setting(container).setName("AI (OpenRouter)").setHeading();

		const apiKeyInfo = container.createDiv({
			cls: "setting-item-description",
		});
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- OpenRouter is a proper noun
		apiKeyInfo.createEl("p", { text: "OpenRouter provides access to multiple AI models through a single API." });
		const linkP = apiKeyInfo.createEl("p");
		linkP.createEl("a", {
			text: "Get your API key at openrouter.ai/keys",
			href: "https://openrouter.ai/keys",
			attr: { target: "_blank" }
		});

		new Setting(container)
			.setName("API key")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- OpenRouter is a proper noun
			.setDesc("Your OpenRouter API key.")
			.addText((text) => {
				text.inputEl.type = "password";
				text.inputEl.addClass("ep:w-[300px]");
				text.setPlaceholder("Enter API key")
					.setValue(this.plugin.settings.openRouterApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openRouterApiKey = value;
						await this.plugin.saveSettings();
					});
			});

		const modelSetting = new Setting(container)
			.setName("AI model")
			.setDesc("Select the AI model");

		modelSetting.addDropdown((dropdown) => {
			const modelsByProvider = this.groupModelsByProvider();

			for (const [provider, models] of Object.entries(modelsByProvider)) {
				dropdown.addOption(`__group_${provider}`, `── ${provider} ──`);

				for (const [key, info] of models) {
					const label = info.recommended
						? `${info.name} ⭐ (${info.description})`
						: `${info.name} (${info.description})`;
					dropdown.addOption(key, label);
				}
			}

			dropdown.setValue(this.plugin.settings.aiModel);
			dropdown.onChange(async (value) => {
				if (value.startsWith("__group_")) {
					dropdown.setValue(this.plugin.settings.aiModel);
					return;
				}
				this.plugin.settings.aiModel = value as AIModelKey;
				await this.plugin.saveSettings();
			});

			const selectEl = dropdown.selectEl;
			Array.from(selectEl.options).forEach((option) => {
				if (option.value.startsWith("__group_")) {
					option.disabled = true;
					option.addClass("ep:font-bold");
					option.addClass("ep:text-obs-muted");
				}
			});
		});

	}

	private renderSchedulingTab(container: HTMLElement): void {
		const preset = this.getSelectedPreset();

		new Setting(container).setName("Learning steps").setHeading();

		const presetNote = container.createDiv({ cls: "setting-item-description" });
		presetNote.createEl("p", {
			text: `Learning steps are configured per-preset. Currently editing: "${preset.name}". Change preset in the FSRS tab.`,
		});

		new Setting(container)
			.setName("Learning steps (minutes)")
			.setDesc("Comma-separated steps for new cards. Default: 1, 10")
			.addText((text) =>
				text
					.setPlaceholder("1, 10")
					.setValue(preset.learningSteps.join(", "))
					.onChange(async (value) => {
						const steps = value
							.split(",")
							.map((s) => parseInt(s.trim()))
							.filter((n) => !isNaN(n) && n > 0);
						await this.updateSelectedPreset({
							learningSteps: steps.length > 0 ? steps : [1, 10],
						});
					})
			);

		new Setting(container)
			.setName("Relearning steps (minutes)")
			.setDesc("Comma-separated steps for lapsed cards. Default: 10")
			.addText((text) =>
				text
					.setPlaceholder("10")
					.setValue(preset.relearningSteps.join(", "))
					.onChange(async (value) => {
						const steps = value
							.split(",")
							.map((s) => parseInt(s.trim()))
							.filter((n) => !isNaN(n) && n > 0);
						await this.updateSelectedPreset({
							relearningSteps: steps.length > 0 ? steps : [10],
						});
					})
			);

		new Setting(container).setName("Display order").setHeading();

		new Setting(container)
			.setName("New card order")
			.setDesc("How to order new cards in the review queue")
			.addDropdown((dropdown) => {
				dropdown.addOption("random", "Random");
				dropdown.addOption(
					"oldest-first",
					"Oldest first (by position in file)"
				);
				dropdown.addOption(
					"newest-first",
					"Newest first (by position in file)"
				);
				dropdown.setValue(this.plugin.settings.newCardOrder);
				dropdown.onChange(async (value) => {
					this.plugin.settings.newCardOrder = value as NewCardOrder;
					await this.plugin.saveSettings();
				});
			});

		new Setting(container)
			.setName("Review order")
			.setDesc("How to order cards due for review")
			.addDropdown((dropdown) => {
				dropdown.addOption("due-date", "By due date");
				dropdown.addOption("random", "Random");
				dropdown.addOption("due-date-random", "Due date, then random");
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- R is a technical term (Retrievability)
				dropdown.addOption("by-retrievability", "By retrievability (lowest R first)");
				dropdown.setValue(this.plugin.settings.reviewOrder);
				dropdown.onChange(async (value) => {
					this.plugin.settings.reviewOrder = value as ReviewOrder;
					await this.plugin.saveSettings();
				});
			});

		new Setting(container)
			.setName("New/review mix")
			.setDesc("When to show new cards relative to reviews")
			.addDropdown((dropdown) => {
				dropdown.addOption("mix-with-reviews", "Mix with reviews");
				dropdown.addOption("show-after-reviews", "Show after reviews");
				dropdown.addOption(
					"show-before-reviews",
					"Show before reviews"
				);
				dropdown.setValue(this.plugin.settings.newReviewMix);
				dropdown.onChange(async (value) => {
					this.plugin.settings.newReviewMix = value as NewReviewMix;
					await this.plugin.saveSettings();
				});
			});
	}

	private getSelectedPreset() {
		const presets = this.plugin.settings.fsrsPresets;
		if (!this.selectedPresetId) {
			this.selectedPresetId = this.plugin.settings.defaultPresetId;
		}
		return presets.find(p => p.id === this.selectedPresetId) ?? presets[0]!;
	}

	private async updateSelectedPreset(changes: Partial<import("../../types/settings.types").FSRSPreset>): Promise<void> {
		await this.plugin.presetService.updatePreset(this.getSelectedPreset().id, changes);
	}

	private renderFSRSTab(container: HTMLElement): void {
		const presets = this.plugin.settings.fsrsPresets;
		const preset = this.getSelectedPreset();

		// ── Preset selector ──
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
		new Setting(container).setName("FSRS presets").setHeading();

		const presetSetting = new Setting(container)
			.setName("Active preset")
			.setDesc("Each preset has its own retention target, weights, steps, and daily limits")
			.addDropdown((dropdown) => {
				for (const p of presets) {
					dropdown.addOption(p.id, p.name);
				}
				dropdown.setValue(preset.id);
				dropdown.onChange((value) => {
					this.selectedPresetId = value;
					this.display();
				});
			});

		presetSetting.addButton((btn) =>
			btn.setButtonText("New").setTooltip("Create new preset").onClick(async () => {
				const base = this.getSelectedPreset();
				const newPreset = await this.plugin.presetService.createPreset({
					name: `${base.name} (copy)`,
					requestRetention: base.requestRetention,
					maximumInterval: base.maximumInterval,
					weights: base.weights ? [...base.weights] : null,
					learningSteps: [...base.learningSteps],
					relearningSteps: [...base.relearningSteps],
					newCardsPerDay: base.newCardsPerDay,
					reviewsPerDay: base.reviewsPerDay,
					lastOptimization: null,
					lastOptimizationReviewCount: null,
					lastOptimizationMetrics: null,
				});
				this.selectedPresetId = newPreset.id;
				this.display();
			})
		);

		const isDefault = preset.id === this.plugin.settings.defaultPresetId;
		if (!isDefault) {
			presetSetting.addButton((btn) =>
				btn.setButtonText("Delete").setWarning().onClick(async () => {
					await this.plugin.presetService.deletePreset(preset.id);
					this.selectedPresetId = this.plugin.settings.defaultPresetId;
					this.display();
				})
			);
		}

		// Rename
		if (!isDefault) {
			new Setting(container)
				.setName("Preset name")
				.addText((text) =>
					text.setValue(preset.name).onChange(async (value) => {
						if (value.trim()) {
							await this.updateSelectedPreset({ name: value.trim() });
						}
					})
				);
		}

		// ── Algorithm settings (per-preset) ──
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
		new Setting(container).setName("FSRS algorithm").setHeading();

		new Setting(container)
			.setName("Desired retention")
			.setDesc(
				`Target probability of recall (${FSRS_CONFIG.minRetention}-${FSRS_CONFIG.maxRetention}). Default: 0.9 (90%)`
			)
			.addSlider((slider) =>
				slider
					.setLimits(
						FSRS_CONFIG.minRetention,
						FSRS_CONFIG.maxRetention,
						0.01
					)
					.setValue(preset.requestRetention)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.updateSelectedPreset({ requestRetention: value });
					})
			);

		new Setting(container)
			.setName("Maximum interval (days)")
			.setDesc("Maximum days between reviews. Default: 36500 (100 years)")
			.addText((text) =>
				text
					.setPlaceholder("36500")
					.setValue(String(preset.maximumInterval))
					.onChange(async (value) => {
						const num = parseInt(value) || 36500;
						await this.updateSelectedPreset({ maximumInterval: Math.max(1, num) });
					})
			);

		// ── Daily limits (per-preset) ──
		new Setting(container).setName("Daily limits").setHeading();

		new Setting(container)
			.setName("New cards per day")
			.setDesc("Maximum number of new cards introduced per day")
			.addText((text) =>
				text
					.setPlaceholder("20")
					.setValue(String(preset.newCardsPerDay))
					.onChange(async (value) => {
						const num = parseInt(value) || 20;
						await this.updateSelectedPreset({ newCardsPerDay: Math.max(0, num) });
					})
			);

		new Setting(container)
			.setName("Reviews per day")
			.setDesc("Maximum number of reviews per day (0 = unlimited)")
			.addText((text) =>
				text
					.setPlaceholder("200")
					.setValue(String(preset.reviewsPerDay))
					.onChange(async (value) => {
						const num = parseInt(value) || 200;
						await this.updateSelectedPreset({ reviewsPerDay: Math.max(0, num) });
					})
			);

		// ── FSRS parameters (per-preset) ──
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
		new Setting(container).setName("FSRS parameters").setHeading();

		const totalReviews = this.plugin.cardStore?.stats?.getTotalReviewCount() ?? 0;
		const lastOpt = preset.lastOptimization;
		const lastOptCount = preset.lastOptimizationReviewCount;

		const optimizerInfo = container.createDiv({ cls: "setting-item-description" });
		// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
		optimizerInfo.createEl("p", { text: "FSRS parameters affect how cards are scheduled. You can optimize them based on your review history." });
		const reviewsP = optimizerInfo.createEl("p");
		reviewsP.createEl("strong", { text: "Current reviews: " });
		reviewsP.appendText(`${totalReviews.toLocaleString()} ${totalReviews < FSRS_CONFIG.minReviewsForOptimization ? `(need ${FSRS_CONFIG.minReviewsForOptimization}+ for optimization)` : "(ready for optimization)"}`);
		if (lastOpt) {
			const lastOptP = optimizerInfo.createEl("p");
			lastOptP.createEl("strong", { text: "Last optimized: " });
			lastOptP.appendText(`${new Date(lastOpt).toLocaleDateString()} (${lastOptCount?.toLocaleString() ?? "unknown"} reviews used)`);
		}

		new Setting(container)
			.setName("Optimize parameters")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
			.setDesc("Analyze your review history to find optimal FSRS weights for this preset")
			.addButton((button) =>
				button
					.setButtonText("Optimize now")
					.setDisabled(totalReviews < FSRS_CONFIG.minReviewsForOptimization)
					.onClick(async () => {
						button.setButtonText("Optimizing...");
						button.setDisabled(true);
						try {
							const result = await this.plugin.fsrsHelper?.optimizeParameters(
								undefined,
								preset.name,
								preset.weights
							);
							if (result && result.metrics.convergenceStatus !== "insufficient_data") {
								await this.updateSelectedPreset({
									weights: result.weights,
									lastOptimization: new Date().toISOString(),
									lastOptimizationReviewCount: result.metrics.reviewCount,
									lastOptimizationMetrics: result.metrics,
								});
								notify().success(`Optimization complete! RMSE: ${result.metrics.rmse.toFixed(4)}`);
								this.display();
							} else {
								notify().error("Optimization failed: insufficient data");
							}
						} catch (err) {
							notify().error(`Optimization failed: ${String(err)}`);
						} finally {
							button.setButtonText("Optimize now");
							button.setDisabled(totalReviews < FSRS_CONFIG.minReviewsForOptimization);
						}
					})
			)
			.addButton((button) =>
				button.setButtonText("Reset to defaults").onClick(async () => {
					await this.updateSelectedPreset({
						weights: null,
						lastOptimization: null,
						lastOptimizationReviewCount: null,
						lastOptimizationMetrics: null,
					});
					notify().success("Parameters reset to defaults");
					this.display();
				})
			);

		const currentWeights = preset.weights;
		const weightsString = currentWeights ? currentWeights.join(", ") : "";

		new Setting(container)
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
			.setName("Custom FSRS weights")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
			.setDesc("Enter 17, 19, or 21 comma-separated values (from FSRS optimizer). Leave empty to use defaults")
			.addTextArea((text) => {
				text.inputEl.rows = 3;
				text.inputEl.cols = 50;
				text.inputEl.addClass("ep:w-full", "ep:font-mono", "ep:text-ui-small");
				text.setPlaceholder("0.40255, 1.18385, 3.173, 15.69105, ...")
					.setValue(weightsString)
					.onChange(async (value) => {
						const trimmed = value.trim();
						if (trimmed === "") {
							await this.updateSelectedPreset({ weights: null });
							return;
						}

						const parts = trimmed
							.split(",")
							.map((s) => parseFloat(s.trim()));
						const validLengths = [17, 19, 21];
						if (!validLengths.includes(parts.length)) {
							notify().error(
								`Invalid weights count: ${parts.length}. Expected 17, 19, or 21 values.`
							);
							return;
						}

						if (parts.some((n) => isNaN(n))) {
							notify().error(
								"Invalid weights: some values are not numbers."
							);
							return;
						}

						await this.updateSelectedPreset({
							weights: parts,
							lastOptimization: new Date().toISOString(),
						});
						notify().success("FSRS weights saved!");
					});
			});

		new Setting(container).setName("Easy days").setHeading();

		const easyDaysInfo = container.createDiv({ cls: "setting-item-description" });
		easyDaysInfo.createEl("p", { text: "Reduce your review workload on specific days (recurring weekdays or specific dates). Cards due on easy days will be moved to adjacent days." });

		// Summary of current easy days
		const easyDays = this.plugin.settings.easyDays;
		const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		const recurringDaysText = easyDays.recurringDays.length > 0
			? easyDays.recurringDays.map((d) => dayNames[d]).join(", ")
			: "None";
		const specificDatesCount = easyDays.specificDates.length;

		new Setting(container)
			.setName("Easy days")
			.setDesc(`Recurring: ${recurringDaysText} | Specific dates: ${specificDatesCount} | Workload: ${Math.round(this.plugin.settings.easyDaysMultiplier * 100)}%`)
			.addButton((button) =>
				button.setButtonText("Configure...").onClick(async () => {
					const modal = new EasyDaysModal(this.app, {
						easyDays: this.plugin.settings.easyDays,
						multiplier: this.plugin.settings.easyDaysMultiplier,
					});
					const result = await modal.openAndWait();

					if (!result.cancelled && result.easyDays) {
						this.plugin.settings.easyDays = result.easyDays;
						if (result.multiplier !== undefined) {
							this.plugin.settings.easyDaysMultiplier = result.multiplier;
						}
						await this.plugin.saveSettings();

						if (result.applyNow) {
							const applyResult = await this.plugin.fsrsHelper?.applyEasyDays({ dryRun: false });
							if (applyResult && applyResult.affectedCount > 0) {
								this.plugin.undoService?.push({
									id: crypto.randomUUID(),
									actionType: "fsrs-helper-operation",
									description: `Apply easy days (${applyResult.affectedCount} cards)`,
									timestamp: Date.now(),
									payload: {
										type: "fsrs-helper-operation",
										operation: "apply-easy-days",
										changes: applyResult.changes.map((c) => ({
											cardId: c.cardId,
											originalDue: c.originalDue,
											newDue: c.newDue,
										})),
									},
								});
								notify().success(`Applied easy days: ${applyResult.affectedCount} cards moved (Ctrl+Z to undo)`);
							} else if (applyResult) {
								notify().info("No cards needed to be moved");
							}
						}

						this.display();
					}
				})
			)
			.addButton((button) =>
				button.setButtonText("Apply now").onClick(async () => {
					const applyResult = await this.plugin.fsrsHelper?.applyEasyDays({ dryRun: false });
					if (applyResult && applyResult.affectedCount > 0) {
						this.plugin.undoService?.push({
							id: crypto.randomUUID(),
							actionType: "fsrs-helper-operation",
							description: `Apply easy days (${applyResult.affectedCount} cards)`,
							timestamp: Date.now(),
							payload: {
								type: "fsrs-helper-operation",
								operation: "apply-easy-days",
								changes: applyResult.changes.map((c) => ({
									cardId: c.cardId,
									originalDue: c.originalDue,
									newDue: c.newDue,
								})),
							},
						});
						notify().success(`Applied easy days: ${applyResult.affectedCount} cards moved (Ctrl+Z to undo)`);
					} else if (applyResult) {
						notify().info("No cards needed to be moved");
					}
				})
			);

		new Setting(container).setName("Load balance").setHeading();

		new Setting(container)
			.setName("Enable load balancing")
			.setDesc("Automatically distribute reviews to prevent workload spikes")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.loadBalanceEnabled)
					.onChange(async (value) => {
						this.plugin.settings.loadBalanceEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Target daily reviews")
			.setDesc("Target number of reviews per day for balancing")
			.addText((text) =>
				text
					.setPlaceholder("100")
					.setValue(String(this.plugin.settings.loadBalanceTarget))
					.onChange(async (value) => {
						const num = parseInt(value) || 100;
						this.plugin.settings.loadBalanceTarget = Math.max(1, num);
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Maximum deviation (%)")
			.setDesc("Allow this much deviation from target before rebalancing")
			.addSlider((slider) =>
				slider
					.setLimits(0, 50, 5)
					.setValue(this.plugin.settings.loadBalanceMaxDeviation)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.loadBalanceMaxDeviation = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Balance workload now")
			.setDesc("Redistribute reviews for the next 30 days")
			.addButton((button) =>
				button.setButtonText("Balance now").onClick(async () => {
					button.setButtonText("Balancing...");
					button.setDisabled(true);
					try {
						const result = await this.plugin.fsrsHelper?.balanceWorkload({ dryRun: false });
						if (result && result.affectedCount > 0) {
							this.plugin.undoService?.push({
								id: crypto.randomUUID(),
								actionType: "fsrs-helper-operation",
								description: `Balance workload (${result.affectedCount} cards)`,
								timestamp: Date.now(),
								payload: {
									type: "fsrs-helper-operation",
									operation: "balance-workload",
									changes: result.changes.map((c) => ({
										cardId: c.cardId,
										originalDue: c.originalDue,
										newDue: c.newDue,
									})),
								},
							});
							notify().success(`Balanced ${result.affectedCount} cards (Ctrl+Z to undo)`);
						} else if (result) {
							notify().info("No cards needed balancing");
						}
					} catch (err) {
						notify().error(`Balance failed: ${String(err)}`);
					} finally {
						button.setButtonText("Balance now");
						button.setDisabled(false);
					}
				})
			);

		new Setting(container).setName("Sibling dispersal").setHeading();

		const siblingInfo = container.createDiv({ cls: "setting-item-description" });
		siblingInfo.createEl("p", { text: "Cards from the same source note are \"siblings\". Spreading them apart helps avoid interference during review." });

		new Setting(container)
			.setName("Enable sibling dispersal")
			.setDesc("Automatically space out cards from the same note")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.siblingDisperseEnabled)
					.onChange(async (value) => {
						this.plugin.settings.siblingDisperseEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Minimum sibling interval")
			.setDesc("Minimum days between siblings from the same source")
			.addText((text) =>
				text
					.setPlaceholder("3")
					.setValue(String(this.plugin.settings.siblingMinInterval))
					.onChange(async (value) => {
						const num = parseInt(value) || 3;
						this.plugin.settings.siblingMinInterval = Math.max(1, num);
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Disperse siblings now")
			.setDesc("Spread out siblings that are currently too close")
			.addButton((button) =>
				button.setButtonText("Disperse now").onClick(async () => {
					button.setButtonText("Dispersing...");
					button.setDisabled(true);
					try {
						const result = await this.plugin.fsrsHelper?.disperseSiblings({ dryRun: false });
						if (result && result.affectedCount > 0) {
							this.plugin.undoService?.push({
								id: crypto.randomUUID(),
								actionType: "fsrs-helper-operation",
								description: `Disperse siblings (${result.affectedCount} cards)`,
								timestamp: Date.now(),
								payload: {
									type: "fsrs-helper-operation",
									operation: "disperse-siblings",
									changes: result.changes.map((c) => ({
										cardId: c.cardId,
										originalDue: c.originalDue,
										newDue: c.newDue,
									})),
								},
							});
							notify().success(`Dispersed ${result.affectedCount} cards (Ctrl+Z to undo)`);
						} else if (result) {
							notify().info("No siblings needed dispersing");
						}
					} catch (err) {
						notify().error(`Disperse failed: ${String(err)}`);
					} finally {
						button.setButtonText("Disperse now");
						button.setDisabled(false);
					}
				})
			);

		new Setting(container).setName("Scheduled breaks").setHeading();

		const breaksInfo = container.createDiv({ cls: "setting-item-description" });
		breaksInfo.createEl("p", { text: "Schedule breaks (vacations) to redistribute reviews and prevent backlog accumulation." });

		const breaks = this.plugin.settings.scheduledBreaks;
		if (breaks.length > 0) {
			const breaksList = container.createDiv({ cls: "ep:space-y-2 ep:mb-4" });
			breaks.forEach((brk, index) => {
				const breakItem = breaksList.createDiv({
					cls: "ep:flex ep:items-center ep:justify-between ep:p-2 ep:bg-obs-background-modifier-form ep:rounded-lg",
				});
				breakItem.createSpan({
					text: `${brk.startDate} to ${brk.endDate}`,
				});
				const deleteBtn = breakItem.createEl("button", {
					text: "Delete",
					cls: "ep:text-ui-small",
				});
				deleteBtn.addEventListener("click", async () => {
					this.plugin.settings.scheduledBreaks = breaks.filter((_, i) => i !== index);
					await this.plugin.saveSettings();
					this.display();
				});
			});
		}

		new Setting(container)
			.setName("Add scheduled break")
			.setDesc("Schedule a break period")
			.addButton((button) =>
				button.setButtonText("Add break...").onClick(async () => {
					// Simple prompt for now - could be a modal
					// eslint-disable-next-line no-alert
					const startDate = prompt("Start date (YYYY-MM-DD):");
					// eslint-disable-next-line no-alert
					const endDate = prompt("End date (YYYY-MM-DD):");
					if (startDate && endDate) {
						const newBreak = {
							id: crypto.randomUUID(),
							startDate,
							endDate,
							redistributeBefore: true,
							redistributeAfter: true,
						};
						this.plugin.settings.scheduledBreaks = [
							...this.plugin.settings.scheduledBreaks,
							newBreak,
						];
						await this.plugin.saveSettings();
						this.display();
					}
				})
			);

		new Setting(container).setName("Bulk operations").setHeading();

		new Setting(container)
			.setName("Reschedule all cards")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- FSRS is an acronym
			.setDesc("Recalculate all intervals with current FSRS weights (preview first)")
			.addButton((button) =>
				button.setButtonText("Preview reschedule").onClick(async () => {
					button.setButtonText("Calculating...");
					button.setDisabled(true);
					try {
						const previewResult = await this.plugin.fsrsHelper?.rescheduleCards({
							scope: "all",
							dryRun: true,
						});
						if (previewResult && previewResult.affectedCount > 0) {
							// eslint-disable-next-line no-alert
							const confirmed = window.confirm(`This will reschedule ${previewResult.affectedCount} cards. Proceed?`);
							if (confirmed) {
								const result = await this.plugin.fsrsHelper?.rescheduleCards({
									scope: "all",
									dryRun: false,
								});
								if (result && result.affectedCount > 0) {
									this.plugin.undoService?.push({
										id: crypto.randomUUID(),
										actionType: "fsrs-helper-operation",
										description: `Reschedule cards (${result.affectedCount} cards)`,
										timestamp: Date.now(),
										payload: {
											type: "fsrs-helper-operation",
											operation: "reschedule-cards",
											changes: result.changes.map((c) => ({
												cardId: c.cardId,
												originalDue: c.originalDue,
												newDue: c.newDue,
											})),
										},
									});
									notify().success(`Rescheduled ${result.affectedCount} cards (Ctrl+Z to undo)`);
								}
							}
						} else if (previewResult) {
							notify().info("No cards to reschedule");
						}
					} catch (err) {
						notify().error(`Reschedule failed: ${String(err)}`);
					} finally {
						button.setButtonText("Preview reschedule");
						button.setDisabled(false);
					}
				})
			);

		new Setting(container)
			.setName("Postpone all due cards")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- N is a variable placeholder
			.setDesc("Push all due cards forward by N days")
			.addText((text) =>
				text.setPlaceholder("7").onChange(() => {})
			)
			.addButton((button) =>
				button.setButtonText("Postpone").onClick(async () => {
					const daysInput = button.buttonEl.parentElement?.querySelector("input");
					const days = parseInt(daysInput?.value || "7") || 7;
					button.setButtonText("Postponing...");
					button.setDisabled(true);
					try {
						const result = await this.plugin.fsrsHelper?.shiftDueDates({
							action: "postpone",
							days,
							scope: "due_today",
							dryRun: false,
						});
						if (result && result.affectedCount > 0) {
							this.plugin.undoService?.push({
								id: crypto.randomUUID(),
								actionType: "fsrs-helper-operation",
								description: `Postpone ${result.affectedCount} cards by ${days} days`,
								timestamp: Date.now(),
								payload: {
									type: "fsrs-helper-operation",
									operation: "shift-due-dates",
									changes: result.changes.map((c) => ({
										cardId: c.cardId,
										originalDue: c.originalDue,
										newDue: c.newDue,
									})),
								},
							});
							notify().success(`Postponed ${result.affectedCount} cards by ${days} days (Ctrl+Z to undo)`);
						} else if (result) {
							notify().info("No cards to postpone");
						}
					} catch (err) {
						notify().error(`Postpone failed: ${String(err)}`);
					} finally {
						button.setButtonText("Postpone");
						button.setDisabled(false);
					}
				})
			);
	}

	private renderDataTab(container: HTMLElement): void {
		new Setting(container).setName("Device database").setHeading();

		const deviceId = this.plugin.deviceIdService?.getDeviceId() || "unknown";
		const deviceLabel = this.plugin.deviceIdService?.getDeviceLabel();

		const deviceInfo = container.createDiv({
			cls: "setting-item-description",
		});
		const deviceIdP = deviceInfo.createEl("p");
		deviceIdP.appendText("Device ID: ");
		deviceIdP.createEl("code", { text: deviceId });
		const dbP = deviceInfo.createEl("p");
		dbP.appendText("Database: ");
		dbP.createEl("code", { text: `.true-recall/true-recall-${deviceId}.db` });

		new Setting(container)
			.setName("Device name")
			.setDesc("Optional name (stored locally)")
			.addText((text) => {
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- placeholder example text
				text.setPlaceholder("e.g., work laptop, phone")
					.setValue(deviceLabel || "")
					.onChange((value) => {
						this.plugin.deviceIdService?.setDeviceLabel(value);
					});
			});

		new Setting(container)
			.setName("Switch database")
			.setDesc("Import data from another device")
			.addButton((button) =>
				button.setButtonText("Switch...").onClick(async () => {
					await this.showDeviceSwitchModal();
				})
			);

		new Setting(container).setName("Database backup").setHeading();

		const backupInfo = container.createDiv({
			cls: "setting-item-description",
		});
		backupInfo.createEl("p", { text: "Create backups of your flashcard database to prevent data loss." });
		const backupPathP = backupInfo.createEl("p");
		backupPathP.appendText("Backups are stored in ");
		backupPathP.createEl("code", { text: ".true-recall/backups/" });

		new Setting(container)
			.setName("Automatic backup on load")
			.setDesc("Create a backup automatically when the plugin loads")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoBackupOnLoad)
					.onChange(async (value) => {
						this.plugin.settings.autoBackupOnLoad = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Maximum backups to keep (legacy)")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- N is a variable placeholder
			.setDesc("Simple retention: keep last N backups. Use smart retention below for better control.")
			.addText((text) =>
				text
					.setPlaceholder("10")
					.setValue(String(this.plugin.settings.maxBackups))
					.onChange(async (value) => {
						const num = parseInt(value) || 0;
						this.plugin.settings.maxBackups = Math.max(0, num);
						await this.plugin.saveSettings();
					})
			);

		new Setting(container).setName("Background backup").setHeading();

		const bgBackupInfo = container.createDiv({
			cls: "setting-item-description",
		});
		bgBackupInfo.createEl("p", { text: "Automatic periodic backups run in the background to protect your data." });
		bgBackupInfo.createEl("p", { text: "Smart retention keeps recent backups densely and older ones sparsely." });

		new Setting(container)
			.setName("Enable periodic backups")
			.setDesc("Automatically backup database at regular intervals")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.periodicBackupEnabled)
					.onChange(async (value) => {
						this.plugin.settings.periodicBackupEnabled = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Backup interval")
			.setDesc("How often to create automatic backups (only when changes exist)")
			.addDropdown((dropdown) => {
				dropdown.addOption("15", "Every 15 minutes");
				dropdown.addOption("30", "Every 30 minutes");
				dropdown.addOption("60", "Every hour");
				dropdown.addOption("120", "Every 2 hours");
				dropdown.addOption("240", "Every 4 hours");
				dropdown.setValue(String(this.plugin.settings.backupIntervalMinutes));
				dropdown.onChange(async (value) => {
					this.plugin.settings.backupIntervalMinutes = parseInt(value) as 0 | 15 | 30 | 60 | 120 | 240;
					await this.plugin.saveSettings();
				});
			});

		new Setting(container)
			.setName("Activity-triggered backup")
			.setDesc("Create backup after completing a certain number of reviews")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.activityTriggeredBackup)
					.onChange(async (value) => {
						this.plugin.settings.activityTriggeredBackup = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Reviews before backup")
			.setDesc("Number of reviews after which to trigger an automatic backup")
			.addText((text) =>
				text
					.setPlaceholder("50")
					.setValue(String(this.plugin.settings.reviewsBeforeBackup))
					.onChange(async (value) => {
						const num = parseInt(value) || 50;
						this.plugin.settings.reviewsBeforeBackup = Math.max(10, num);
						await this.plugin.saveSettings();
					})
			);

		new Setting(container).setName("Smart retention").setHeading();

		const retentionInfo = container.createDiv({
			cls: "setting-item-description",
		});
		const { hourlyBackupsToKeep, dailyBackupsToKeep, weeklyBackupsToKeep } =
			this.plugin.settings.retentionPolicy;
		retentionInfo.createEl("p", { text: "Multi-tier retention keeps recent backups densely and older ones sparsely." });
		const policyP = retentionInfo.createEl("p");
		policyP.appendText("Current policy: ");
		policyP.createEl("strong", { text: `${hourlyBackupsToKeep}h / ${dailyBackupsToKeep}d / ${weeklyBackupsToKeep}w` });

		new Setting(container)
			.setName("Hourly backups")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- N is a variable placeholder
			.setDesc("Keep one backup per hour for the last N hours (0 = disabled)")
			.addSlider((slider) =>
				slider
					.setLimits(0, 48, 1)
					.setValue(this.plugin.settings.retentionPolicy.hourlyBackupsToKeep)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.retentionPolicy.hourlyBackupsToKeep = value;
						await this.plugin.saveSettings();
						this.display(); // Refresh to update summary
					})
			);

		new Setting(container)
			.setName("Daily backups")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- N is a variable placeholder
			.setDesc("Keep one backup per day for the last N days (0 = disabled)")
			.addSlider((slider) =>
				slider
					.setLimits(0, 30, 1)
					.setValue(this.plugin.settings.retentionPolicy.dailyBackupsToKeep)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.retentionPolicy.dailyBackupsToKeep = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		new Setting(container)
			.setName("Weekly backups")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- N is a variable placeholder
			.setDesc("Keep one backup per week for the last N weeks (0 = disabled)")
			.addSlider((slider) =>
				slider
					.setLimits(0, 12, 1)
					.setValue(this.plugin.settings.retentionPolicy.weeklyBackupsToKeep)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.retentionPolicy.weeklyBackupsToKeep = value;
						await this.plugin.saveSettings();
						this.display();
					})
			);

		// Backup status display
		if (this.plugin.backgroundBackupManager) {
			const status = this.plugin.backgroundBackupManager.getStatus();
			const statusDiv = container.createDiv({
				cls: "setting-item-description ep:mt-4",
			});

			const lastBackup = status.lastBackupTime
				? new Date(status.lastBackupTime).toLocaleString()
				: "Never (this session)";
			const nextBackup = status.nextScheduledBackup
				? new Date(status.nextScheduledBackup).toLocaleString()
				: "Not scheduled";

			const statusTitleP = statusDiv.createEl("p");
			statusTitleP.createEl("strong", { text: "Backup status:" });
			statusDiv.createEl("p", { text: `Last backup: ${lastBackup}` });
			statusDiv.createEl("p", { text: `Next scheduled: ${nextBackup}` });
			statusDiv.createEl("p", { text: `Reviews since last backup: ${status.reviewsSinceLastBackup}` });
		}

		new Setting(container).setName("Manual backup").setHeading();

		new Setting(container)
			.setName("Create backup now")
			.setDesc("Manually create a backup of the current database")
			.addButton((button) =>
				button.setButtonText("Create backup").onClick(async () => {
					await this.plugin.createManualBackup();
				})
			);

		new Setting(container)
			.setName("Restore from backup")
			.setDesc(
				"Restore the database from a previous backup (requires Obsidian reload)"
			)
			.addButton((button) =>
				button
					.setButtonText("Restore...")
					.setWarning()
					.onClick(async () => {
						await this.plugin.openRestoreBackupModal();
					})
			);

		new Setting(container).setName("Anki import / export").setHeading();

		new Setting(container)
			.setName("Import Anki deck")
			.setDesc("Import flashcards from an Anki .apkg file with optional scheduling data")
			.addButton((button) =>
				button.setButtonText("Import .apkg").onClick(async () => {
					await this.plugin.importAnki();
				})
			);

		new Setting(container)
			.setName("Export to Anki")
			.setDesc("Export your flashcards as an Anki-compatible .apkg file")
			.addButton((button) =>
				button.setButtonText("Export .apkg").onClick(async () => {
					await this.plugin.exportAnki();
				})
			);

		new Setting(container)
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- CSV/TSV is an acronym
			.setName("Export as CSV/TSV")
			.setDesc("Export your flashcards as a CSV or TSV file for use in spreadsheets or other tools")
			.addButton((button) =>
				button.setButtonText("Export CSV").onClick(async () => {
					await this.plugin.exportCsv();
				})
			);

		new Setting(container).setName("Content").setHeading();

		new Setting(container)
			.setName("Excluded folders")
			.setDesc(
				"Comma-separated list of folders to exclude from flashcard search"
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- placeholder example text
					.setPlaceholder("templates, archive")
					.setValue(this.plugin.settings.excludedFolders.join(", "))
					.onChange(async (value) => {
						const folders = value
							.split(",")
							.map((s) => s.trim())
							.filter((s) => s.length > 0);
						this.plugin.settings.excludedFolders = folders;
						await this.plugin.saveSettings();
					})
			);

	}

	private renderSyncTab(container: HTMLElement): void {
		new Setting(container).setName("Cloud sync").setHeading();

		const comingSoon = container.createDiv({
			cls: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:py-12 ep:text-center",
		});
		comingSoon.createEl("p", {
			text: "Coming soon",
			cls: "ep:text-obs-normal ep:text-ui-large ep:font-semibold ep:mb-2",
		});
		comingSoon.createEl("p", {
			text: "Cross-device synchronization is currently in development.",
			cls: "ep:text-obs-muted ep:text-ui-small",
		});
	}

	hide(): void {}

	private groupModelsByProvider(): Record<string, [string, AIModelInfo][]> {
		const groups: Record<string, [string, AIModelInfo][]> = {
			Google: [],
			OpenAI: [],
			Anthropic: [],
			Meta: [],
		};

		for (const [key, info] of Object.entries(AI_MODELS_EXTENDED)) {
			const providerGroup = groups[info.provider];
			if (providerGroup) {
				providerGroup.push([key, info]);
			}
		}

		// Sort: recommended models first within each group
		for (const provider of Object.keys(groups)) {
			const providerGroup = groups[provider];
			if (providerGroup) {
				providerGroup.sort((a, b) => {
					if (a[1].recommended && !b[1].recommended) return -1;
					if (!a[1].recommended && b[1].recommended) return 1;
					return 0;
				});
			}
		}

		return groups;
	}

	private async showDeviceSwitchModal(): Promise<void> {
		if (!this.plugin.deviceDiscovery || !this.plugin.deviceIdService) {
			notify().error("Device services not initialized");
			return;
		}

		const databases = await this.plugin.deviceDiscovery.discoverDeviceDatabases();
		const otherDevices = databases.filter((db) => !db.isCurrentDevice);

		if (otherDevices.length === 0) {
			notify().info("No other device databases available to import");
			return;
		}

		const modal = new DeviceSelectionModal(this.app, {
			databases: otherDevices,
			hasLegacy: false,
		});

		const result = await modal.openAndWait();
		if (result.cancelled || result.action !== "import" || !result.sourcePath) {
			return;
		}

		// eslint-disable-next-line no-alert
		const confirmed = confirm(`Are you sure you want to replace the current database with data from device ${result.sourceDeviceId}?\n\nThe current database will be overwritten. This requires restarting Obsidian.`);

		if (!confirmed) {
			return;
		}

		try {
			const deviceId = this.plugin.deviceIdService.getDeviceId();
			const { normalizePath } = await import("obsidian");
			const { DB_FOLDER, getDeviceDbFilename } = await import(
				"../../services/persistence/sqlite/sqlite.types"
			);

			const targetPath = normalizePath(
				`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}`
			);

			const backupPath = normalizePath(
				`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}.backup`
			);
			const currentData = await this.app.vault.adapter.readBinary(targetPath);
			await this.app.vault.adapter.writeBinary(backupPath, currentData);

			const sourceData = await this.app.vault.adapter.readBinary(
				result.sourcePath
			);
			await this.app.vault.adapter.writeBinary(targetPath, sourceData);

			notify().success(
				`Imported data from device ${result.sourceDeviceId}. Please restart Obsidian.`
			);
		} catch (error) {
			console.error("[True Recall] Database switch failed:", error);
			notify().error("Failed to switch database.");
		}
	}
}
