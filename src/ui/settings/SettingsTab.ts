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

type SettingsTabId = "scheduling" | "interface" | "integration";

/**
 * Settings tab for Episteme plugin
 */
export class EpistemeSettingTab extends PluginSettingTab {
    plugin: EpistemePlugin;
    private activeTab: SettingsTabId = "scheduling";

    constructor(app: App, plugin: EpistemePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.addClass("episteme-settings");

        // Tab navigation
        const tabsNav = containerEl.createDiv({ cls: "episteme-settings-tabs" });
        const tabs: { id: SettingsTabId; label: string }[] = [
            { id: "scheduling", label: "Scheduling" },
            { id: "interface", label: "Interface" },
            { id: "integration", label: "Integration" },
        ];

        const tabButtons: Map<SettingsTabId, HTMLElement> = new Map();
        tabs.forEach(tab => {
            const btn = tabsNav.createEl("button", {
                text: tab.label,
                cls: `episteme-settings-tab-btn ${this.activeTab === tab.id ? "is-active" : ""}`,
            });
            btn.addEventListener("click", () => this.switchTab(tab.id, tabButtons, tabContents));
            tabButtons.set(tab.id, btn);
        });

        // Tab content containers
        const tabContents: Map<SettingsTabId, HTMLElement> = new Map();
        tabs.forEach(tab => {
            const content = containerEl.createDiv({
                cls: `episteme-settings-tab-content ${this.activeTab === tab.id ? "is-active" : ""}`,
            });
            tabContents.set(tab.id, content);
        });

        // Render content for each tab
        this.renderSchedulingTab(tabContents.get("scheduling")!);
        this.renderInterfaceTab(tabContents.get("interface")!);
        this.renderIntegrationTab(tabContents.get("integration")!);
    }

    private switchTab(
        tabId: SettingsTabId,
        buttons: Map<SettingsTabId, HTMLElement>,
        contents: Map<SettingsTabId, HTMLElement>
    ): void {
        this.activeTab = tabId;
        buttons.forEach((btn, id) => btn.toggleClass("is-active", id === tabId));
        contents.forEach((content, id) => content.toggleClass("is-active", id === tabId));
    }

    private renderSchedulingTab(container: HTMLElement): void {
        // ===== FSRS Algorithm Section =====
        container.createEl("h2", { text: "FSRS Algorithm" });

        new Setting(container)
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

        new Setting(container)
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
        container.createEl("h2", { text: "Daily Limits" });

        new Setting(container)
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

        new Setting(container)
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
        container.createEl("h2", { text: "Learning Steps" });

        new Setting(container)
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

        new Setting(container)
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

        new Setting(container)
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

        new Setting(container)
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

        // ===== Display Order Section =====
        container.createEl("h2", { text: "Display Order" });

        new Setting(container)
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

        new Setting(container)
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

        new Setting(container)
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
        container.createEl("h2", { text: "Scheduling" });

        new Setting(container)
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
            .addButton(button => button
                .setButtonText("Optimize Parameters")
                .setDisabled(true)
                .onClick(async () => {
                    // TODO: Implement optimization
                }))
            .addButton(button => button
                .setButtonText("Reset to Defaults")
                .onClick(async () => {
                    this.plugin.settings.fsrsWeights = null;
                    this.plugin.settings.lastOptimization = null;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        const currentWeights = this.plugin.settings.fsrsWeights;
        const weightsString = currentWeights ? currentWeights.join(", ") : "";

        new Setting(container)
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

                        const parts = trimmed.split(",").map(s => parseFloat(s.trim()));
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

    private renderInterfaceTab(container: HTMLElement): void {
        // ===== Review Interface Section =====
        container.createEl("h2", { text: "Review Interface" });

        new Setting(container)
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

        new Setting(container)
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

        new Setting(container)
            .setName("Show review header")
            .setDesc("Display header with close button, stats and progress in review session")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showReviewHeader)
                .onChange(async (value) => {
                    this.plugin.settings.showReviewHeader = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(container)
            .setName("Show header stats")
            .setDesc("Display new/learning/due counters in review session header")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showReviewHeaderStats)
                .onChange(async (value) => {
                    this.plugin.settings.showReviewHeaderStats = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(container)
            .setName("Show next review time")
            .setDesc("Display predicted interval on answer buttons")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showNextReviewTime)
                .onChange(async (value) => {
                    this.plugin.settings.showNextReviewTime = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(container)
            .setName("Continuous custom reviews")
            .setDesc("Show 'Next Session' button after completing a custom review session, allowing you to quickly start another review with different filters")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.continuousCustomReviews)
                .onChange(async (value) => {
                    this.plugin.settings.continuousCustomReviews = value;
                    await this.plugin.saveSettings();
                }));

        // ===== Flashcard Collection Section =====
        container.createEl("h2", { text: "Flashcard Collection" });

        new Setting(container)
            .setName("Remove content after collecting")
            .setDesc("When enabled, removes the entire flashcard (question + answer) from markdown after collecting. When disabled, only removes the #flashcard tag and keeps the content.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.removeFlashcardContentAfterCollect)
                .onChange(async (value) => {
                    this.plugin.settings.removeFlashcardContentAfterCollect = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(container)
            .setName("Autocomplete search folder")
            .setDesc("Folder to search for note linking autocomplete. Leave empty to search all folders.")
            .addText(text => text
                .setPlaceholder("e.g., Notes or Zettelkasten")
                .setValue(this.plugin.settings.autocompleteSearchFolder)
                .onChange(async (value) => {
                    this.plugin.settings.autocompleteSearchFolder = value.trim();
                    await this.plugin.saveSettings();
                }));
    }

    private renderIntegrationTab(container: HTMLElement): void {
        // ===== Zettelkasten Section =====
        container.createEl("h2", { text: "Zettelkasten" });

        new Setting(container)
            .setName("Zettel folder")
            .setDesc("Folder where zettel notes created from flashcards will be stored")
            .addText(text => text
                .setPlaceholder("Zettel")
                .setValue(this.plugin.settings.zettelFolder)
                .onChange(async (value) => {
                    this.plugin.settings.zettelFolder = value || "Zettel";
                    await this.plugin.saveSettings();
                }));

        // ===== AI Generation Section =====
        container.createEl("h2", { text: "AI Generation" });

        new Setting(container)
            .setDesc("Get your API key at openrouter.ai/keys");

        new Setting(container)
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

        new Setting(container)
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

        new Setting(container)
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
    }
}
