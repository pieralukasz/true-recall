/**
 * Settings Tab UI
 * Plugin settings configuration interface
 */
import { App, Notice, PluginSettingTab, Setting, TFile } from "obsidian";
import type EpistemePlugin from "../../main";
import {
	DEFAULT_SETTINGS,
	AI_MODELS_EXTENDED,
	FSRS_CONFIG,
	SYSTEM_PROMPT,
	UPDATE_SYSTEM_PROMPT,
} from "../../constants";
import { TemplatePickerModal, DeviceSelectionModal, FirstSyncConflictModal } from "../modals";
import type { AIModelKey, AIModelInfo } from "../../constants";
import type {
	EpistemeSettings,
	ReviewViewMode,
	NewCardOrder,
	ReviewOrder,
	NewReviewMix,
} from "../../types";

// Re-export for convenience
export { DEFAULT_SETTINGS };
export type { EpistemeSettings };

type SettingsTabId = "general" | "ai" | "scheduling" | "data" | "sync";

/**
 * Settings tab for Episteme plugin
 */
export class EpistemeSettingTab extends PluginSettingTab {
	plugin: EpistemePlugin;
	private activeTab: SettingsTabId = "general";

	constructor(app: App, plugin: EpistemePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("episteme-settings");

		// Tab navigation
		const tabsNav = containerEl.createDiv({
			cls: "episteme-settings-tabs",
		});
		const tabs: { id: SettingsTabId; label: string }[] = [
			{ id: "general", label: "General" },
			{ id: "ai", label: "AI" },
			{ id: "scheduling", label: "Scheduling" },
			{ id: "data", label: "Data & Backup" },
			{ id: "sync", label: "Cloud Sync" },
		];

		const tabButtons: Map<SettingsTabId, HTMLElement> = new Map();
		tabs.forEach((tab) => {
			const btn = tabsNav.createEl("button", {
				text: tab.label,
				cls: `episteme-settings-tab-btn ${
					this.activeTab === tab.id ? "is-active" : ""
				}`,
			});
			btn.addEventListener("click", () =>
				this.switchTab(tab.id, tabButtons, tabContents)
			);
			tabButtons.set(tab.id, btn);
		});

		// Tab content containers
		const tabContents: Map<SettingsTabId, HTMLElement> = new Map();
		tabs.forEach((tab) => {
			const content = containerEl.createDiv({
				cls: `episteme-settings-tab-content ${
					this.activeTab === tab.id ? "is-active" : ""
				}`,
			});
			tabContents.set(tab.id, content);
		});

		// Render content for each tab
		this.renderGeneralTab(tabContents.get("general")!);
		this.renderAITab(tabContents.get("ai")!);
		this.renderSchedulingTab(tabContents.get("scheduling")!);
		this.renderDataTab(tabContents.get("data")!);
		this.renderSyncTab(tabContents.get("sync")!);
	}

	private switchTab(
		tabId: SettingsTabId,
		buttons: Map<SettingsTabId, HTMLElement>,
		contents: Map<SettingsTabId, HTMLElement>
	): void {
		this.activeTab = tabId;
		buttons.forEach((btn, id) =>
			btn.toggleClass("is-active", id === tabId)
		);
		contents.forEach((content, id) =>
			content.toggleClass("is-active", id === tabId)
		);
	}

	private renderGeneralTab(container: HTMLElement): void {
		// ===== Review Interface Section =====
		container.createEl("h2", { text: "Review Interface" });

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
			.setDesc(
				"Show 'Next Session' button after completing a custom review session"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.continuousCustomReviews)
					.onChange(async (value) => {
						this.plugin.settings.continuousCustomReviews = value;
						await this.plugin.saveSettings();
					})
			);

		// ===== Daily Limits Section =====
		container.createEl("h2", { text: "Daily Limits" });

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

		// ===== Day Boundary Section =====
		container.createEl("h2", { text: "Day Boundary" });

		new Setting(container)
			.setName("Next day starts at")
			.setDesc("Hour when a new day begins (0-23). Default: 4 (4:00 AM)")
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

		// ===== Flashcard Collection Section =====
		container.createEl("h2", { text: "Flashcard Collection" });

		new Setting(container)
			.setName("Remove content after collecting")
			.setDesc(
				"When enabled, removes the entire flashcard (Q+A) from markdown after collecting. When disabled, only removes the #flashcard tag."
			)
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
	}

	private renderAITab(container: HTMLElement): void {
		// ===== AI Generation Section =====
		container.createEl("h2", { text: "AI Generation (OpenRouter)" });

		const apiKeyInfo = container.createDiv({
			cls: "setting-item-description",
		});
		apiKeyInfo.innerHTML = `
            <p>OpenRouter provides access to multiple AI models through a single API.</p>
            <p><a href="https://openrouter.ai/keys" target="_blank">Get your API key at openrouter.ai/keys</a></p>
        `;

		new Setting(container)
			.setName("API key")
			.setDesc("Your OpenRouter API key for flashcard generation")
			.addText((text) => {
				text.inputEl.type = "password";
				text.inputEl.addClass("episteme-api-input");
				text.setPlaceholder("Enter API key")
					.setValue(this.plugin.settings.openRouterApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openRouterApiKey = value;
						await this.plugin.saveSettings();
					});
			});

		const modelSetting = new Setting(container)
			.setName("AI model")
			.setDesc("Select the AI model for flashcard generation");

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
					option.style.fontWeight = "bold";
					option.style.color = "var(--text-muted)";
				}
			});
		});

		// ===== Custom Prompts Section =====
		container.createEl("h2", { text: "Custom Prompts" });

		const promptsInfo = container.createDiv({
			cls: "setting-item-description",
		});
		promptsInfo.innerHTML = `
            <p>Customize the AI prompts used for flashcard generation. Leave empty to use the default prompts.</p>
        `;

		new Setting(container)
			.setName("Flashcard generation prompt")
			.setDesc(
				"Custom system prompt for generating new flashcards. Leave empty to use default."
			)
			.addTextArea((text) => {
				text.inputEl.rows = 8;
				text.inputEl.style.width = "100%";
				text.inputEl.style.fontFamily = "monospace";
				text.inputEl.style.fontSize = "12px";
				text.setPlaceholder(this.truncatePrompt(SYSTEM_PROMPT, 500))
					.setValue(this.plugin.settings.customGeneratePrompt)
					.onChange(async (value) => {
						this.plugin.settings.customGeneratePrompt = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName("Flashcard update prompt")
			.setDesc(
				"Custom system prompt for updating existing flashcards. Leave empty to use default."
			)
			.addTextArea((text) => {
				text.inputEl.rows = 8;
				text.inputEl.style.width = "100%";
				text.inputEl.style.fontFamily = "monospace";
				text.inputEl.style.fontSize = "12px";
				text.setPlaceholder(
					this.truncatePrompt(UPDATE_SYSTEM_PROMPT, 500)
				)
					.setValue(this.plugin.settings.customUpdatePrompt)
					.onChange(async (value) => {
						this.plugin.settings.customUpdatePrompt = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(container)
			.setName("Reset prompts to defaults")
			.setDesc("Clear custom prompts and use the built-in defaults")
			.addButton((button) =>
				button.setButtonText("Reset to Defaults").onClick(async () => {
					this.plugin.settings.customGeneratePrompt = "";
					this.plugin.settings.customUpdatePrompt = "";
					await this.plugin.saveSettings();
					new Notice("Prompts reset to defaults");
					this.display();
				})
			);
	}

	private renderSchedulingTab(container: HTMLElement): void {
		// ===== FSRS Algorithm Section =====
		container.createEl("h2", { text: "FSRS Algorithm" });

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
					.setValue(this.plugin.settings.fsrsRequestRetention)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.fsrsRequestRetention = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Maximum interval (days)")
			.setDesc("Maximum days between reviews. Default: 36500 (100 years)")
			.addText((text) =>
				text
					.setPlaceholder("36500")
					.setValue(String(this.plugin.settings.fsrsMaximumInterval))
					.onChange(async (value) => {
						const num = parseInt(value) || 36500;
						this.plugin.settings.fsrsMaximumInterval = Math.max(
							1,
							num
						);
						await this.plugin.saveSettings();
					})
			);

		// ===== Learning Steps Section =====
		container.createEl("h2", { text: "Learning Steps" });

		new Setting(container)
			.setName("Learning steps (minutes)")
			.setDesc("Comma-separated steps for new cards. Default: 1, 10")
			.addText((text) =>
				text
					.setPlaceholder("1, 10")
					.setValue(this.plugin.settings.learningSteps.join(", "))
					.onChange(async (value) => {
						const steps = value
							.split(",")
							.map((s) => parseInt(s.trim()))
							.filter((n) => !isNaN(n) && n > 0);
						this.plugin.settings.learningSteps =
							steps.length > 0 ? steps : [1, 10];
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Relearning steps (minutes)")
			.setDesc("Comma-separated steps for lapsed cards. Default: 10")
			.addText((text) =>
				text
					.setPlaceholder("10")
					.setValue(this.plugin.settings.relearningSteps.join(", "))
					.onChange(async (value) => {
						const steps = value
							.split(",")
							.map((s) => parseInt(s.trim()))
							.filter((n) => !isNaN(n) && n > 0);
						this.plugin.settings.relearningSteps =
							steps.length > 0 ? steps : [10];
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Graduating interval (days)")
			.setDesc("Interval after completing learning steps. Default: 1")
			.addText((text) =>
				text
					.setPlaceholder("1")
					.setValue(String(this.plugin.settings.graduatingInterval))
					.onChange(async (value) => {
						const num = parseInt(value) || 1;
						this.plugin.settings.graduatingInterval = Math.max(
							1,
							num
						);
						await this.plugin.saveSettings();
					})
			);

		new Setting(container)
			.setName("Easy interval (days)")
			.setDesc("Interval when pressing Easy on new card. Default: 4")
			.addText((text) =>
				text
					.setPlaceholder("4")
					.setValue(String(this.plugin.settings.easyInterval))
					.onChange(async (value) => {
						const num = parseInt(value) || 4;
						this.plugin.settings.easyInterval = Math.max(1, num);
						await this.plugin.saveSettings();
					})
			);

		// ===== Display Order Section =====
		container.createEl("h2", { text: "Display Order" });

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

		// ===== FSRS Parameters Section =====
		container.createEl("h2", { text: "FSRS Parameters" });

		const infoEl = container.createDiv({ cls: "setting-item-description" });
		infoEl.innerHTML = `
            <p>FSRS parameters affect how cards are scheduled. The plugin starts with default parameters optimized for most users.</p>
            <p>You can optimize parameters based on your review history to get the best results for your memory and content.</p>
            <p><strong>Minimum ${FSRS_CONFIG.minReviewsForOptimization} reviews required.</strong> Recommended: ${FSRS_CONFIG.recommendedReviewsForOptimization}+ reviews.</p>
        `;

		const lastOpt = this.plugin.settings.lastOptimization;
		new Setting(container)
			.setName("Last optimization")
			.setDesc(lastOpt ? new Date(lastOpt).toLocaleDateString() : "Never")
			.addButton((button) =>
				button
					.setButtonText("Optimize Parameters")
					.setDisabled(true)
					.onClick(async () => {
						// TODO: Implement optimization
					})
			)
			.addButton((button) =>
				button.setButtonText("Reset to Defaults").onClick(async () => {
					this.plugin.settings.fsrsWeights = null;
					this.plugin.settings.lastOptimization = null;
					await this.plugin.saveSettings();
					this.display();
				})
			);

		const currentWeights = this.plugin.settings.fsrsWeights;
		const weightsString = currentWeights ? currentWeights.join(", ") : "";

		new Setting(container)
			.setName("Custom FSRS weights")
			.setDesc(
				"Enter 17, 19, or 21 comma-separated values (from FSRS optimizer). Leave empty to use defaults."
			)
			.addTextArea((text) => {
				text.inputEl.rows = 3;
				text.inputEl.cols = 50;
				text.inputEl.style.width = "100%";
				text.inputEl.style.fontFamily = "monospace";
				text.inputEl.style.fontSize = "12px";
				text.setPlaceholder("0.40255, 1.18385, 3.173, 15.69105, ...")
					.setValue(weightsString)
					.onChange(async (value) => {
						const trimmed = value.trim();
						if (trimmed === "") {
							this.plugin.settings.fsrsWeights = null;
							await this.plugin.saveSettings();
							return;
						}

						const parts = trimmed
							.split(",")
							.map((s) => parseFloat(s.trim()));
						const validLengths = [17, 19, 21];
						if (!validLengths.includes(parts.length)) {
							new Notice(
								`Invalid weights count: ${parts.length}. Expected 17, 19, or 21 values.`
							);
							return;
						}

						if (parts.some((n) => isNaN(n))) {
							new Notice(
								"Invalid weights: some values are not numbers."
							);
							return;
						}

						this.plugin.settings.fsrsWeights = parts;
						this.plugin.settings.lastOptimization =
							new Date().toISOString();
						await this.plugin.saveSettings();
						new Notice("FSRS weights saved!");
					});
			});
	}

	private renderDataTab(container: HTMLElement): void {
		// ===== Device Database Section =====
		container.createEl("h2", { text: "Device Database" });

		const deviceId = this.plugin.deviceIdService?.getDeviceId() || "unknown";
		const deviceLabel = this.plugin.deviceIdService?.getDeviceLabel();

		const deviceInfo = container.createDiv({
			cls: "setting-item-description",
		});
		deviceInfo.innerHTML = `
			<p>Device ID: <code>${deviceId}</code></p>
			<p>Database: <code>.episteme/episteme-${deviceId}.db</code></p>
		`;

		new Setting(container)
			.setName("Device name")
			.setDesc("Optional name (stored locally)")
			.addText((text) => {
				text.setPlaceholder("e.g. MacBook Pro, iPhone")
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

		// ===== Database Backup Section =====
		container.createEl("h2", { text: "Database Backup" });

		const backupInfo = container.createDiv({
			cls: "setting-item-description",
		});
		backupInfo.innerHTML = `
            <p>Create backups of your flashcard database to prevent data loss.</p>
            <p>Backups are stored in <code>.episteme/backups/</code></p>
        `;

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
			.setName("Maximum backups to keep")
			.setDesc(
				"Number of backups to keep (0 = unlimited). Oldest backups are deleted automatically."
			)
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

		new Setting(container)
			.setName("Create backup now")
			.setDesc("Manually create a backup of the current database")
			.addButton((button) =>
				button.setButtonText("Create Backup").onClick(async () => {
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

		// ===== Content Settings Section =====
		container.createEl("h2", { text: "Content Settings" });

		// Zettelkasten

		new Setting(container)
			.setName("Zettel folder")
			.setDesc(
				"Folder where zettel notes created from flashcards will be stored"
			)
			.addText((text) =>
				text
					.setPlaceholder("Zettel")
					.setValue(this.plugin.settings.zettelFolder)
					.onChange(async (value) => {
						this.plugin.settings.zettelFolder = value || "Zettel";
						await this.plugin.saveSettings();
					})
			);

		// Template file setting
		const templateSetting = new Setting(container)
			.setName("Zettel template")
			.setDesc(
				"Template file for creating zettels. Variables: {{question}}, {{answer}}, {{source}}, {{date}}, {{time}}, {{datetime}}, {{card_id}}"
			);

		const templateInputEl = templateSetting.controlEl.createEl("input", {
			type: "text",
			cls: "episteme-template-input",
			placeholder: "Default template",
			value: this.plugin.settings.zettelTemplatePath,
		});
		templateInputEl.readOnly = true;
		templateInputEl.style.cursor = "pointer";

		// Display basename if path is set, otherwise show placeholder
		const updateTemplateDisplay = (): void => {
			const path = this.plugin.settings.zettelTemplatePath;
			if (path) {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (file instanceof TFile) {
					templateInputEl.value = file.basename;
				} else {
					templateInputEl.value = path;
				}
			} else {
				templateInputEl.value = "";
			}
		};
		updateTemplateDisplay();

		templateInputEl.addEventListener("click", async () => {
			const modal = new TemplatePickerModal(this.app);
			const result = await modal.openAndWait();
			if (!result.cancelled) {
				this.plugin.settings.zettelTemplatePath =
					result.templatePath ?? "";
				await this.plugin.saveSettings();
				updateTemplateDisplay();
			}
		});

		templateSetting.addButton((button) =>
			button.setButtonText("Browse").onClick(async () => {
				const modal = new TemplatePickerModal(this.app);
				const result = await modal.openAndWait();
				if (!result.cancelled) {
					this.plugin.settings.zettelTemplatePath =
						result.templatePath ?? "";
					await this.plugin.saveSettings();
					updateTemplateDisplay();
				}
			})
		);

		templateSetting.addButton((button) =>
			button.setButtonText("Clear").onClick(async () => {
				this.plugin.settings.zettelTemplatePath = "";
				await this.plugin.saveSettings();
				updateTemplateDisplay();
			})
		);

		// Excluded folders
		new Setting(container)
			.setName("Excluded folders")
			.setDesc(
				"Comma-separated list of folders to exclude from flashcard search"
			)
			.addText((text) =>
				text
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
		// ===== Supabase Configuration Section =====
		container.createEl("h2", { text: "Supabase Configuration" });

		const supabaseInfo = container.createDiv({
			cls: "setting-item-description",
		});
		supabaseInfo.innerHTML = `
			<p>Connect to Supabase for cloud synchronization across devices.</p>
			<p><a href="https://supabase.com" target="_blank">Create a free Supabase project</a></p>
		`;

		new Setting(container)
			.setName("Supabase URL")
			.setDesc("Your Supabase project URL")
			.addText((text) => {
				text.inputEl.addClass("episteme-api-input");
				text.setPlaceholder("https://your-project.supabase.co")
					.setValue(this.plugin.settings.supabaseUrl)
					.onChange(async (value) => {
						this.plugin.settings.supabaseUrl = value;
						await this.plugin.saveSettings();
						this.updateAuthSection(container);
					});
			});

		new Setting(container)
			.setName("Supabase Anon Key")
			.setDesc("Your Supabase anonymous/public key")
			.addText((text) => {
				text.inputEl.type = "password";
				text.inputEl.addClass("episteme-api-input");
				text.setPlaceholder("Enter anon key")
					.setValue(this.plugin.settings.supabaseAnonKey)
					.onChange(async (value) => {
						this.plugin.settings.supabaseAnonKey = value;
						await this.plugin.saveSettings();
						this.updateAuthSection(container);
					});
			});

		// ===== Authentication Section =====
		container.createEl("h2", { text: "Authentication" });

		const authContainer = container.createDiv({
			cls: "episteme-auth-section",
		});
		authContainer.id = "episteme-auth-container";

		this.renderAuthSection(authContainer);
	}

	private updateAuthSection(container: HTMLElement): void {
		const authContainer = container.querySelector("#episteme-auth-container");
		if (authContainer) {
			authContainer.empty();
			this.renderAuthSection(authContainer as HTMLElement);
		}
	}

	private renderAuthSection(container: HTMLElement): void {
		const isConfigured =
			this.plugin.settings.supabaseUrl &&
			this.plugin.settings.supabaseAnonKey;

		if (!isConfigured) {
			const notice = container.createDiv({
				cls: "setting-item-description",
			});
			notice.setText(
				"Configure Supabase URL and Anon Key above to enable authentication."
			);
			return;
		}

		// Check current auth state
		void this.renderAuthState(container);
	}

	private async renderAuthState(container: HTMLElement): Promise<void> {
		const authService = this.plugin.authService;

		if (!authService || !authService.isConfigured()) {
			const notice = container.createDiv({
				cls: "setting-item-description",
			});
			notice.setText("Authentication service not initialized.");
			return;
		}

		const authState = await authService.getAuthState();

		if (authState.isAuthenticated && authState.user) {
			// Logged in state
			const userInfo = container.createDiv({
				cls: "setting-item-description",
			});
			userInfo.innerHTML = `<p>Logged in as: <strong>${authState.user.email}</strong></p>`;

			new Setting(container)
				.setName("Sign out")
				.setDesc("Sign out of your account")
				.addButton((button) =>
					button
						.setButtonText("Logout")
						.setWarning()
						.onClick(async () => {
							const result = await authService.signOut();
							if (result.success) {
								new Notice("Logged out successfully");
								container.empty();
								this.renderAuthSection(container);
							} else {
								new Notice(`Logout failed: ${result.error}`);
							}
						})
				);

			// ===== Sync Controls (shown when authenticated) =====
			this.renderSyncControls(container);
		} else {
			// Not logged in - show login form
			this.renderLoginForm(container);
		}
	}

	private renderLoginForm(container: HTMLElement): void {
		const formContainer = container.createDiv({
			cls: "episteme-auth-form",
		});

		let emailValue = "";
		let passwordValue = "";
		const statusEl = formContainer.createDiv({
			cls: "episteme-auth-status",
		});

		new Setting(formContainer)
			.setName("Email")
			.addText((text) => {
				text.inputEl.type = "email";
				text.setPlaceholder("your@email.com").onChange((value) => {
					emailValue = value;
				});
			});

		new Setting(formContainer)
			.setName("Password")
			.addText((text) => {
				text.inputEl.type = "password";
				text.setPlaceholder("Password").onChange((value) => {
					passwordValue = value;
				});
			});

		const buttonContainer = formContainer.createDiv({
			cls: "episteme-auth-buttons",
		});

		const loginBtn = buttonContainer.createEl("button", {
			text: "Login",
			cls: "mod-cta",
		});

		const signupBtn = buttonContainer.createEl("button", {
			text: "Sign Up",
		});

		const setStatus = (message: string, isError: boolean): void => {
			statusEl.empty();
			statusEl.setText(message);
			statusEl.toggleClass("episteme-auth-error", isError);
			statusEl.toggleClass("episteme-auth-success", !isError);
		};

		loginBtn.addEventListener("click", async () => {
			if (!emailValue || !passwordValue) {
				setStatus("Please enter email and password", true);
				return;
			}

			const authService = this.plugin.authService;
			if (!authService) {
				setStatus("Auth service not available", true);
				return;
			}

			loginBtn.disabled = true;
			signupBtn.disabled = true;
			setStatus("Logging in...", false);

			const result = await authService.signIn(emailValue, passwordValue);

			if (result.success) {
				new Notice("Logged in successfully");
				container.empty();
				this.renderAuthSection(container);
			} else {
				setStatus(result.error ?? "Login failed", true);
				loginBtn.disabled = false;
				signupBtn.disabled = false;
			}
		});

		signupBtn.addEventListener("click", async () => {
			if (!emailValue || !passwordValue) {
				setStatus("Please enter email and password", true);
				return;
			}

			const authService = this.plugin.authService;
			if (!authService) {
				setStatus("Auth service not available", true);
				return;
			}

			loginBtn.disabled = true;
			signupBtn.disabled = true;
			setStatus("Creating account...", false);

			const result = await authService.signUp(emailValue, passwordValue);

			if (result.success) {
				// Auto-login after signup
				const loginResult = await authService.signIn(
					emailValue,
					passwordValue
				);
				if (loginResult.success) {
					new Notice("Account created and logged in");
					container.empty();
					this.renderAuthSection(container);
				} else {
					setStatus(
						"Account created. Please log in.",
						false
					);
					loginBtn.disabled = false;
					signupBtn.disabled = false;
				}
			} else {
				setStatus(result.error ?? "Sign up failed", true);
				loginBtn.disabled = false;
				signupBtn.disabled = false;
			}
		});
	}

	/**
	 * Render sync controls (shown when authenticated)
	 */
	private renderSyncControls(container: HTMLElement): void {
		const syncService = this.plugin.syncService;
		if (!syncService) {
			return;
		}

		container.createEl("h3", { text: "Synchronization" });

		// Last sync info
		const lastSyncTimestamp = syncService.getLastSyncTimestamp();
		const lastSyncText = lastSyncTimestamp > 0
			? new Date(lastSyncTimestamp).toLocaleString()
			: "Never";

		const syncStatusEl = container.createDiv({
			cls: "setting-item-description",
		});
		syncStatusEl.id = "episteme-sync-status";
		syncStatusEl.setText(`Last sync: ${lastSyncText}`);

		// Sync button
		new Setting(container)
			.setName("Sync now")
			.setDesc("Synchronize flashcards with cloud")
			.addButton((button) =>
				button
					.setButtonText("Sync")
					.setCta()
					.onClick(async () => {
						button.setDisabled(true);
						button.setButtonText("Checking...");
						syncStatusEl.setText("Checking sync status...");

						// Check for first sync conflict (Anki-style)
						const status = await syncService.checkFirstSyncStatus();

						let result;

						if (status.hasConflict) {
							// Show conflict dialog
							const modal = new FirstSyncConflictModal(this.app);
							const choice = await modal.openAndWait();

							if (choice.cancelled) {
								button.setDisabled(false);
								button.setButtonText("Sync");
								syncStatusEl.setText(`Last sync: ${lastSyncText}`);
								return;
							}

							syncStatusEl.setText(
								choice.choice === "upload" ? "Uploading..." : "Downloading..."
							);
							button.setButtonText(
								choice.choice === "upload" ? "Uploading..." : "Downloading..."
							);

							if (choice.choice === "upload") {
								result = await syncService.forceReplace();
							} else {
								result = await syncService.forcePull();
							}
						} else if (status.isFirstSync) {
							// First sync - auto-detect direction
							if (status.hasLocalData && !status.hasRemoteData) {
								syncStatusEl.setText("First sync: Uploading...");
								button.setButtonText("Uploading...");
								result = await syncService.forceReplace();
							} else if (!status.hasLocalData && status.hasRemoteData) {
								syncStatusEl.setText("First sync: Downloading...");
								button.setButtonText("Downloading...");
								result = await syncService.forcePull();
							} else {
								// Both empty - normal sync
								syncStatusEl.setText("Syncing...");
								button.setButtonText("Syncing...");
								result = await syncService.sync();
							}
						} else {
							// Normal sync
							syncStatusEl.setText("Syncing...");
							button.setButtonText("Syncing...");
							result = await syncService.sync();
						}

						if (result.success) {
							const newTimestamp = syncService.getLastSyncTimestamp();
							const newTimeText = new Date(newTimestamp).toLocaleString();
							syncStatusEl.setText(
								`Last sync: ${newTimeText} (↓${result.pulled} ↑${result.pushed})`
							);
							new Notice(`Sync complete: ${result.pulled} pulled, ${result.pushed} pushed`);
						} else {
							syncStatusEl.setText(`Sync failed: ${result.error}`);
							new Notice(`Sync failed: ${result.error}`);
						}

						button.setDisabled(false);
						button.setButtonText("Sync");
					})
			);

		// Force replace option (destructive - overwrites server)
		new Setting(container)
			.setName("Force replace")
			.setDesc("⚠️ Deletes ALL server data and uploads local database")
			.addButton((button) =>
				button
					.setButtonText("Force Replace")
					.setWarning()
					.onClick(async () => {
						// Confirmation dialog
						const confirmed = confirm(
							"WARNING: This will DELETE all your data on the server and replace it with your local database.\n\n" +
							"Other devices will lose their changes.\n\n" +
							"Are you sure you want to continue?"
						);

						if (!confirmed) return;

						button.setDisabled(true);
						button.setButtonText("Replacing...");
						syncStatusEl.setText("Force replacing all data...");

						const result = await syncService.forceReplace();

						if (result.success) {
							const newTimestamp = syncService.getLastSyncTimestamp();
							const newTimeText = new Date(newTimestamp).toLocaleString();
							syncStatusEl.setText(
								`Last sync: ${newTimeText} (replaced ↑${result.pushed})`
							);
							new Notice(`Force replace complete: ${result.pushed} records uploaded`);
						} else {
							syncStatusEl.setText(`Replace failed: ${result.error}`);
							new Notice(`Replace failed: ${result.error}`);
						}

						button.setDisabled(false);
						button.setButtonText("Force Replace");
					})
			);

		// Force pull option (destructive - overwrites local)
		new Setting(container)
			.setName("Force pull")
			.setDesc("⚠️ Deletes ALL local data and downloads from server")
			.addButton((button) =>
				button
					.setButtonText("Force Pull")
					.setWarning()
					.onClick(async () => {
						// Confirmation dialog
						const confirmed = confirm(
							"WARNING: This will DELETE all your LOCAL data and replace it with server data.\n\n" +
							"Any local changes not synced will be lost.\n\n" +
							"Are you sure you want to continue?"
						);

						if (!confirmed) return;

						button.setDisabled(true);
						button.setButtonText("Pulling...");
						syncStatusEl.setText("Force pulling all data...");

						const result = await syncService.forcePull();

						if (result.success) {
							const newTimestamp = syncService.getLastSyncTimestamp();
							const newTimeText = new Date(newTimestamp).toLocaleString();
							syncStatusEl.setText(
								`Last sync: ${newTimeText} (pulled ↓${result.pulled})`
							);
							new Notice(`Force pull complete: ${result.pulled} records downloaded`);
						} else {
							syncStatusEl.setText(`Pull failed: ${result.error}`);
							new Notice(`Pull failed: ${result.error}`);
						}

						button.setDisabled(false);
						button.setButtonText("Force Pull");
					})
			);
	}

	hide(): void {
		// No cleanup needed currently
	}

	/**
	 * Group AI models by provider for the dropdown
	 */
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

	/**
	 * Truncate prompt for placeholder display
	 */
	private truncatePrompt(prompt: string, maxLength: number): string {
		if (prompt.length <= maxLength) return prompt;
		return prompt.substring(0, maxLength) + "...";
	}

	/**
	 * Show modal to switch device database
	 */
	private async showDeviceSwitchModal(): Promise<void> {
		if (!this.plugin.deviceDiscovery || !this.plugin.deviceIdService) {
			new Notice("Device services not initialized");
			return;
		}

		const databases = await this.plugin.deviceDiscovery.discoverDeviceDatabases();
		const otherDevices = databases.filter((db) => !db.isCurrentDevice);

		if (otherDevices.length === 0) {
			new Notice("No other device databases available to import");
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

		// Confirm the switch
		const confirmed = confirm(
			`Are you sure you want to replace the current database with data from device ${result.sourceDeviceId}?\n\n` +
			"The current database will be overwritten. This requires restarting Obsidian."
		);

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

			// Create backup of current database
			const backupPath = normalizePath(
				`${DB_FOLDER}/${getDeviceDbFilename(deviceId)}.backup`
			);
			const currentData = await this.app.vault.adapter.readBinary(targetPath);
			await this.app.vault.adapter.writeBinary(backupPath, currentData);

			// Copy source database to current
			const sourceData = await this.app.vault.adapter.readBinary(
				result.sourcePath
			);
			await this.app.vault.adapter.writeBinary(targetPath, sourceData);

			new Notice(
				`Imported data from device ${result.sourceDeviceId}. Please restart Obsidian.`
			);
		} catch (error) {
			console.error("[Episteme] Database switch failed:", error);
			new Notice("Failed to switch database.");
		}
	}
}
