/**
 * Settings Tab UI
 * Plugin settings configuration interface
 */
import { App, PluginSettingTab, Setting } from "obsidian";
import type ShadowAnkiPlugin from "../../main";
import { DEFAULT_SETTINGS, AI_MODELS, FSRS_CONFIG } from "../../constants";
import type { AIModelKey } from "../../constants";
import type { ShadowAnkiSettings, ReviewViewMode } from "../../types";

// Re-export for convenience
export { DEFAULT_SETTINGS };
export type { ShadowAnkiSettings };

/**
 * Settings tab for Shadow Anki plugin
 */
export class ShadowAnkiSettingTab extends PluginSettingTab {
    plugin: ShadowAnkiPlugin;

    constructor(app: App, plugin: ShadowAnkiPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // ===== AI Generation Section =====
        containerEl.createEl("h2", { text: "AI Generation" });

        // Info about OpenRouter
        new Setting(containerEl)
            .setDesc("Get your API key at openrouter.ai/keys");

        // 1. OpenRouter API Key (password field)
        new Setting(containerEl)
            .setName("API key")
            .setDesc("Your openrouter.ai API key for flashcard generation")
            .addText(text => {
                text.inputEl.type = "password";
                text.inputEl.addClass("shadow-anki-api-input");
                text.setPlaceholder("Enter API key")
                    .setValue(this.plugin.settings.openRouterApiKey)
                    .onChange(async (value) => {
                        this.plugin.settings.openRouterApiKey = value;
                        await this.plugin.saveSettings();
                    });
            });

        // 2. AI Model dropdown
        new Setting(containerEl)
            .setName("AI model")
            .setDesc("Select the AI model for flashcard generation")
            .addDropdown(dropdown => {
                Object.entries(AI_MODELS).forEach(([value, label]) => {
                    dropdown.addOption(value, label);
                });
                dropdown.setValue(this.plugin.settings.aiModel);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.aiModel = value as AIModelKey;
                    await this.plugin.saveSettings();
                });
            });

        // 3. Flashcards Folder Path
        new Setting(containerEl)
            .setName("Flashcards folder")
            .setDesc("Folder where flashcard files will be stored")
            .addText(text => text
                .setPlaceholder("Flashcards")
                .setValue(this.plugin.settings.flashcardsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.flashcardsFolder = value || "Flashcards";
                    await this.plugin.saveSettings();
                }));

        // 4. Store Source Content toggle
        new Setting(containerEl)
            .setName("Store source content")
            .setDesc("Save note content in flashcard file for better diff comparison")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.storeSourceContent)
                .onChange(async (value) => {
                    this.plugin.settings.storeSourceContent = value;
                    await this.plugin.saveSettings();
                }));

        // ===== FSRS Algorithm Section =====
        containerEl.createEl("h2", { text: "FSRS Algorithm" });

        // Request Retention
        new Setting(containerEl)
            .setName("Desired retention")
            .setDesc(`Target probability of recall (${FSRS_CONFIG.minRetention}-${FSRS_CONFIG.maxRetention}). Default: 0.9 (90%)`)
            .addSlider(slider => slider
                .setLimits(FSRS_CONFIG.minRetention, FSRS_CONFIG.maxRetention, 0.01)
                .setValue(this.plugin.settings.fsrsRequestRetention)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.fsrsRequestRetention = value;
                    await this.plugin.saveSettings();
                }));

        // Maximum Interval
        new Setting(containerEl)
            .setName("Maximum interval (days)")
            .setDesc("Maximum days between reviews. Default: 36500 (100 years)")
            .addText(text => text
                .setPlaceholder("36500")
                .setValue(String(this.plugin.settings.fsrsMaximumInterval))
                .onChange(async (value) => {
                    const num = parseInt(value) || 36500;
                    this.plugin.settings.fsrsMaximumInterval = Math.max(1, num);
                    await this.plugin.saveSettings();
                }));

        // ===== Daily Limits Section =====
        containerEl.createEl("h2", { text: "Daily Limits" });

        // New Cards Per Day
        new Setting(containerEl)
            .setName("New cards per day")
            .setDesc("Maximum number of new cards to study each day")
            .addText(text => text
                .setPlaceholder("20")
                .setValue(String(this.plugin.settings.newCardsPerDay))
                .onChange(async (value) => {
                    const num = parseInt(value) || 20;
                    this.plugin.settings.newCardsPerDay = Math.max(0, num);
                    await this.plugin.saveSettings();
                }));

        // Reviews Per Day
        new Setting(containerEl)
            .setName("Maximum reviews per day")
            .setDesc("Maximum number of reviews per day")
            .addText(text => text
                .setPlaceholder("200")
                .setValue(String(this.plugin.settings.reviewsPerDay))
                .onChange(async (value) => {
                    const num = parseInt(value) || 200;
                    this.plugin.settings.reviewsPerDay = Math.max(0, num);
                    await this.plugin.saveSettings();
                }));

        // ===== Learning Steps Section =====
        containerEl.createEl("h2", { text: "Learning Steps" });

        // Learning Steps
        new Setting(containerEl)
            .setName("Learning steps (minutes)")
            .setDesc("Comma-separated steps for new cards. Default: 1, 10")
            .addText(text => text
                .setPlaceholder("1, 10")
                .setValue(this.plugin.settings.learningSteps.join(", "))
                .onChange(async (value) => {
                    const steps = value.split(",")
                        .map(s => parseInt(s.trim()))
                        .filter(n => !isNaN(n) && n > 0);
                    this.plugin.settings.learningSteps = steps.length > 0 ? steps : [1, 10];
                    await this.plugin.saveSettings();
                }));

        // Relearning Steps
        new Setting(containerEl)
            .setName("Relearning steps (minutes)")
            .setDesc("Comma-separated steps for lapsed cards. Default: 10")
            .addText(text => text
                .setPlaceholder("10")
                .setValue(this.plugin.settings.relearningSteps.join(", "))
                .onChange(async (value) => {
                    const steps = value.split(",")
                        .map(s => parseInt(s.trim()))
                        .filter(n => !isNaN(n) && n > 0);
                    this.plugin.settings.relearningSteps = steps.length > 0 ? steps : [10];
                    await this.plugin.saveSettings();
                }));

        // Graduating Interval
        new Setting(containerEl)
            .setName("Graduating interval (days)")
            .setDesc("Interval after completing learning steps. Default: 1")
            .addText(text => text
                .setPlaceholder("1")
                .setValue(String(this.plugin.settings.graduatingInterval))
                .onChange(async (value) => {
                    const num = parseInt(value) || 1;
                    this.plugin.settings.graduatingInterval = Math.max(1, num);
                    await this.plugin.saveSettings();
                }));

        // Easy Interval
        new Setting(containerEl)
            .setName("Easy interval (days)")
            .setDesc("Interval when pressing Easy on new card. Default: 4")
            .addText(text => text
                .setPlaceholder("4")
                .setValue(String(this.plugin.settings.easyInterval))
                .onChange(async (value) => {
                    const num = parseInt(value) || 4;
                    this.plugin.settings.easyInterval = Math.max(1, num);
                    await this.plugin.saveSettings();
                }));

        // ===== Review UI Section =====
        containerEl.createEl("h2", { text: "Review Interface" });

        // Review Mode
        new Setting(containerEl)
            .setName("Review mode")
            .setDesc("Where to open the review session")
            .addDropdown(dropdown => {
                dropdown.addOption("fullscreen", "Fullscreen (main area)");
                dropdown.addOption("panel", "Side panel");
                dropdown.setValue(this.plugin.settings.reviewMode);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.reviewMode = value as ReviewViewMode;
                    await this.plugin.saveSettings();
                });
            });

        // Show Next Review Time
        new Setting(containerEl)
            .setName("Show next review time")
            .setDesc("Display predicted interval on answer buttons")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showNextReviewTime)
                .onChange(async (value) => {
                    this.plugin.settings.showNextReviewTime = value;
                    await this.plugin.saveSettings();
                }));

        // Show Progress
        new Setting(containerEl)
            .setName("Show progress bar")
            .setDesc("Display progress bar during review session")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showProgress)
                .onChange(async (value) => {
                    this.plugin.settings.showProgress = value;
                    await this.plugin.saveSettings();
                }));

        // ===== FSRS Parameters Section =====
        containerEl.createEl("h2", { text: "FSRS Parameters" });

        // Info text
        const infoEl = containerEl.createDiv({ cls: "setting-item-description" });
        infoEl.innerHTML = `
            <p>FSRS parameters affect how cards are scheduled. The plugin starts with default parameters optimized for most users.</p>
            <p>You can optimize parameters based on your review history to get the best results for your memory and content.</p>
            <p><strong>Minimum ${FSRS_CONFIG.minReviewsForOptimization} reviews required.</strong> Recommended: ${FSRS_CONFIG.recommendedReviewsForOptimization}+ reviews.</p>
        `;

        // Last Optimization
        const lastOpt = this.plugin.settings.lastOptimization;
        new Setting(containerEl)
            .setName("Last optimization")
            .setDesc(lastOpt ? new Date(lastOpt).toLocaleDateString() : "Never")
            .addButton(button => button
                .setButtonText("Optimize Parameters")
                .setDisabled(true) // Will be enabled when we have enough reviews
                .onClick(async () => {
                    // TODO: Implement optimization
                    // new Notice("Optimization not yet implemented");
                }))
            .addButton(button => button
                .setButtonText("Reset to Defaults")
                .onClick(async () => {
                    this.plugin.settings.fsrsWeights = null;
                    this.plugin.settings.lastOptimization = null;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh
                }));

        // Current Weights (read-only display)
        if (this.plugin.settings.fsrsWeights) {
            new Setting(containerEl)
                .setName("Current weights")
                .setDesc(this.plugin.settings.fsrsWeights.slice(0, 5).map(w => w.toFixed(2)).join(", ") + "...");
        }
    }
}
