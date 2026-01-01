import { App, PluginSettingTab, Setting } from "obsidian";
import type ShadowAnkiPlugin from "./main";
import { DEFAULT_SETTINGS, AI_MODELS, AIModelKey } from "./constants";

// Settings interface
export interface ShadowAnkiSettings {
    openRouterApiKey: string;
    aiModel: AIModelKey;
    flashcardsFolder: string;
    autoSyncToAnki: boolean;
}

// Re-export for convenience
export { DEFAULT_SETTINGS };

// Settings Tab UI
export class ShadowAnkiSettingTab extends PluginSettingTab {
    plugin: ShadowAnkiPlugin;

    constructor(app: App, plugin: ShadowAnkiPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

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
            .setDesc("Folder where flashcard files will be stored (recommended to exclude from graph)")
            .addText(text => text
                .setPlaceholder("Flashcards")
                .setValue(this.plugin.settings.flashcardsFolder)
                .onChange(async (value) => {
                    this.plugin.settings.flashcardsFolder = value || "Flashcards";
                    await this.plugin.saveSettings();
                }));

        // 4. Auto-Sync toggle
        new Setting(containerEl)
            .setName("Auto-sync")
            .setDesc("Sync with Anki after generating flashcards")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSyncToAnki)
                .onChange(async (value) => {
                    this.plugin.settings.autoSyncToAnki = value;
                    await this.plugin.saveSettings();
                }));
    }
}
