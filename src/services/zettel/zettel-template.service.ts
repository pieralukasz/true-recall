/**
 * Zettel Template Service
 * Handles loading templates and replacing variables for zettel creation
 */
import { type App, TFile } from "obsidian";
import type { FSRSFlashcardItem } from "../../types";

/**
 * Template variables that can be used in zettel templates
 */
export interface TemplateVariables {
    question: string;
    answer: string;
    source: string;
    date: string;
    time: string;
    datetime: string;
    card_id: string;
}

/**
 * Default template used when no custom template is selected
 */
const DEFAULT_TEMPLATE = `{{question}}

{{answer}}

---
Source: [[{{source}}]]
`;

/**
 * Service for handling zettel template operations
 */
export class ZettelTemplateService {
    constructor(private app: App) {}

    /**
     * Generate zettel content from a flashcard using the specified template
     * @param templatePath - Path to the template file (empty string uses default)
     * @param card - The flashcard to create a zettel from
     * @returns The generated content
     */
    async generateContent(templatePath: string, card: FSRSFlashcardItem): Promise<string> {
        let template = DEFAULT_TEMPLATE;

        // Load custom template if specified
        if (templatePath) {
            const customTemplate = await this.loadTemplate(templatePath);
            if (customTemplate !== null) {
                template = customTemplate;
            }
        }

        // Build variables
        const variables = this.buildVariables(card);

        // Replace variables in template
        return this.replaceVariables(template, variables);
    }

    /**
     * Load template content from a file
     * @param path - Path to the template file
     * @returns Template content or null if file not found
     */
    async loadTemplate(path: string): Promise<string | null> {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) {
            return null;
        }

        try {
            return await this.app.vault.cachedRead(file);
        } catch (error) {
            console.error("Error loading template:", error);
            return null;
        }
    }

    /**
     * Build template variables from a flashcard
     */
    private buildVariables(card: FSRSFlashcardItem): TemplateVariables {
        const now = new Date();
        const date = now.toISOString().split("T")[0] ?? "";
        const time = now.toTimeString().slice(0, 5);
        const datetime = `${date} ${time}`;

        return {
            question: card.question,
            answer: card.answer,
            source: card.sourceNoteName ?? "Unknown",
            date,
            time,
            datetime,
            card_id: card.id,
        };
    }

    /**
     * Replace template variables with actual values
     * Supports {{variable}} syntax
     */
    private replaceVariables(template: string, variables: TemplateVariables): string {
        let result = template;

        // Replace each variable
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
            result = result.replace(regex, value);
        }

        return result;
    }

    /**
     * Get the default template content (for display in settings)
     */
    getDefaultTemplate(): string {
        return DEFAULT_TEMPLATE;
    }
}
