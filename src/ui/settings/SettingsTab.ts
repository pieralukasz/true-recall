/**
 * Settings Tab UI
 * Plugin settings configuration interface
 */
import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type EpistemePlugin from "../../main";
import { DEFAULT_SETTINGS, AI_MODELS, FSRS_CONFIG } from "../../constants";
import type { AIModelKey } from "../../constants";
import type { EpistemeSettings, ReviewViewMode, NewCardOrder, ReviewOrder, NewReviewMix, CustomSessionInterface } from "../../types";

// Re-export for convenience
export { DEFAULT_SETTINGS };
export type { EpistemeSettings };

/**
 * Settings tab for Episteme plugin
 */
export class EpistemeSettingTab extends PluginSettingTab {
    plugin: EpistemePlugin;

    constructor(app: App, plugin: EpistemePlugin) {
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
                text.inputEl.addClass("episteme-api-input");
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

        // 3b. Excluded Folders
        new Setting(containerEl)
            .setName("Excluded folders")
            .setDesc("Comma-separated list of folders to exclude from missing flashcards search (e.g., templates, archive)")
            .addText(text => text
                .setPlaceholder("templates, archive")
                .setValue(this.plugin.settings.excludedFolders.join(", "))
                .onChange(async (value) => {
                    const folders = value.split(",")
                        .map(s => s.trim())
                        .filter(s => s.length > 0);
                    this.plugin.settings.excludedFolders = folders;
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

        // Custom Session Interface
        new Setting(containerEl)
            .setName("Custom session interface")
            .setDesc("How to display the custom session selection interface")
            .addDropdown(dropdown => {
                dropdown.addOption("modal", "Modal (popup)");
                dropdown.addOption("panel", "Side panel");
                dropdown.setValue(this.plugin.settings.customSessionInterface);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.customSessionInterface = value as CustomSessionInterface;
                    await this.plugin.saveSettings();
                });
            });

        // Show Review Header
        new Setting(containerEl)
            .setName("Show review header")
            .setDesc("Display header with close button, stats and progress in review session")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showReviewHeader)
                .onChange(async (value) => {
                    this.plugin.settings.showReviewHeader = value;
                    await this.plugin.saveSettings();
                }));

        // Show Review Header Stats
        new Setting(containerEl)
            .setName("Show header stats")
            .setDesc("Display new/learning/due counters in review session header")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showReviewHeaderStats)
                .onChange(async (value) => {
                    this.plugin.settings.showReviewHeaderStats = value;
                    await this.plugin.saveSettings();
                }));

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

        // Continuous Custom Reviews
        new Setting(containerEl)
            .setName("Continuous custom reviews")
            .setDesc("Show 'Next Session' button after completing a custom review session, allowing you to quickly start another review with different filters")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.continuousCustomReviews)
                .onChange(async (value) => {
                    this.plugin.settings.continuousCustomReviews = value;
                    await this.plugin.saveSettings();
                }));

        // Autocomplete Search Folder
        new Setting(containerEl)
            .setName("Autocomplete search folder")
            .setDesc("Folder to search for note linking autocomplete. Leave empty to search all folders.")
            .addText(text => text
                .setPlaceholder("e.g., Notes or Zettelkasten")
                .setValue(this.plugin.settings.autocompleteSearchFolder)
                .onChange(async (value) => {
                    this.plugin.settings.autocompleteSearchFolder = value.trim();
                    await this.plugin.saveSettings();
                }));

        // ===== Display Order Section =====
        containerEl.createEl("h2", { text: "Display Order" });

        // New Card Order
        new Setting(containerEl)
            .setName("New card order")
            .setDesc("How to order new cards in the review queue")
            .addDropdown(dropdown => {
                dropdown.addOption("random", "Random");
                dropdown.addOption("oldest-first", "Oldest first (by position in file)");
                dropdown.addOption("newest-first", "Newest first (by position in file)");
                dropdown.setValue(this.plugin.settings.newCardOrder);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.newCardOrder = value as NewCardOrder;
                    await this.plugin.saveSettings();
                });
            });

        // Review Card Order
        new Setting(containerEl)
            .setName("Review order")
            .setDesc("How to order cards due for review")
            .addDropdown(dropdown => {
                dropdown.addOption("due-date", "By due date");
                dropdown.addOption("random", "Random");
                dropdown.addOption("due-date-random", "Due date, then random");
                dropdown.setValue(this.plugin.settings.reviewOrder);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.reviewOrder = value as ReviewOrder;
                    await this.plugin.saveSettings();
                });
            });

        // New/Review Mix
        new Setting(containerEl)
            .setName("New/review mix")
            .setDesc("When to show new cards relative to reviews")
            .addDropdown(dropdown => {
                dropdown.addOption("mix-with-reviews", "Mix with reviews");
                dropdown.addOption("show-after-reviews", "Show after reviews");
                dropdown.addOption("show-before-reviews", "Show before reviews");
                dropdown.setValue(this.plugin.settings.newReviewMix);
                dropdown.onChange(async (value) => {
                    this.plugin.settings.newReviewMix = value as NewReviewMix;
                    await this.plugin.saveSettings();
                });
            });

        // ===== Scheduling Section =====
        containerEl.createEl("h2", { text: "Scheduling" });

        // Day Start Hour
        new Setting(containerEl)
            .setName("Next day starts at")
            .setDesc("Hour when a new day begins (0-23). All review cards due 'today' become available after this time. Default: 4 (4:00 AM)")
            .addSlider(slider => slider
                .setLimits(0, 23, 1)
                .setValue(this.plugin.settings.dayStartHour)
                .setDynamicTooltip()
                .onChange(async (value) => {
                    this.plugin.settings.dayStartHour = value;
                    await this.plugin.saveSettings();
                }));

        // ===== Zettelkasten Section =====
        containerEl.createEl("h2", { text: "Zettelkasten" });

        // Zettel Folder
        new Setting(containerEl)
            .setName("Zettel folder")
            .setDesc("Folder where zettel notes created from flashcards will be stored")
            .addText(text => text
                .setPlaceholder("Zettel")
                .setValue(this.plugin.settings.zettelFolder)
                .onChange(async (value) => {
                    this.plugin.settings.zettelFolder = value || "Zettel";
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

        // Custom Weights Input
        const currentWeights = this.plugin.settings.fsrsWeights;
        const weightsString = currentWeights ? currentWeights.join(", ") : "";

        new Setting(containerEl)
            .setName("Custom FSRS weights")
            .setDesc("Enter 17, 19, or 21 comma-separated values (from FSRS optimizer). Leave empty to use defaults.")
            .addTextArea(text => {
                text.inputEl.rows = 3;
                text.inputEl.cols = 50;
                text.inputEl.style.width = "100%";
                text.inputEl.style.fontFamily = "monospace";
                text.inputEl.style.fontSize = "12px";
                text
                    .setPlaceholder("0.40255, 1.18385, 3.173, 15.69105, ...")
                    .setValue(weightsString)
                    .onChange(async (value) => {
                        const trimmed = value.trim();
                        if (trimmed === "") {
                            this.plugin.settings.fsrsWeights = null;
                            await this.plugin.saveSettings();
                            return;
                        }

                        // Parse weights
                        const parts = trimmed.split(",").map(s => parseFloat(s.trim()));

                        // Validate - accept FSRS v4.5 (17), v5 (19), or v6 (21)
                        const validLengths = [17, 19, 21];
                        if (!validLengths.includes(parts.length)) {
                            new Notice(`Invalid weights count: ${parts.length}. Expected 17, 19, or 21 values.`);
                            return;
                        }

                        if (parts.some(n => isNaN(n))) {
                            new Notice("Invalid weights: some values are not numbers.");
                            return;
                        }

                        this.plugin.settings.fsrsWeights = parts;
                        this.plugin.settings.lastOptimization = new Date().toISOString();
                        await this.plugin.saveSettings();
                        new Notice("FSRS weights saved!");
                    });
            });
    }
}
