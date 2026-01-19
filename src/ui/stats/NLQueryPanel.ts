/**
 * Natural Language Query Panel
 * UI component for asking questions about flashcard statistics in natural language
 */
import { MarkdownRenderer, type App, type Component } from "obsidian";
import type { NLQueryService } from "../../services/ai/nl-query.service";
import type { NLQueryResult, ExampleQuery } from "../../types";

/**
 * Example queries for the UI
 */
const EXAMPLE_QUERIES: ExampleQuery[] = [
    {
        text: "How many cards did I review this week?",
        query: "How many cards did I review this week?",
    },
    {
        text: "Which cards have the most lapses?",
        query: "Show me the top 10 cards with the most lapses",
    },
    {
        text: "What's my average success rate?",
        query: "What is my average success rate (percentage of Good or Easy ratings)?",
    },
    {
        text: "Cards created today",
        query: "How many cards were created today?",
    },
    {
        text: "Most difficult cards",
        query: "Show me the 10 most difficult cards by difficulty score",
    },
];

/**
 * Panel for natural language queries
 */
export class NLQueryPanel {
    private containerEl: HTMLElement;
    private app: App;
    private component: Component;
    private nlQueryService: NLQueryService | null = null;
    private isLoading = false;

    // UI Elements
    private inputEl!: HTMLTextAreaElement;
    private submitBtn!: HTMLButtonElement;
    private resultsEl!: HTMLElement;
    private examplesEl!: HTMLElement;

    constructor(containerEl: HTMLElement, app: App, component: Component) {
        this.containerEl = containerEl;
        this.app = app;
        this.component = component;
    }

    /**
     * Set the NL Query Service (may be null if not configured)
     */
    setService(service: NLQueryService | null): void {
        this.nlQueryService = service;
        this.updateUIState();
    }

    /**
     * Render the panel
     */
    render(): void {
        this.containerEl.empty();
        this.containerEl.createEl("h3", { text: "Ask AI" });

        // Description
        this.containerEl.createDiv({
            cls: "nl-query-description",
            text: "Ask questions about your flashcard statistics in natural language.",
        });

        // Input area
        const inputContainer = this.containerEl.createDiv({ cls: "nl-query-input-container" });

        this.inputEl = inputContainer.createEl("textarea", {
            cls: "nl-query-input",
            placeholder: "e.g., How many cards did I review this week?",
        });
        this.inputEl.rows = 2;

        // Handle Enter key (Shift+Enter for new line)
        this.inputEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void this.submitQuery();
            }
        });

        // Submit button
        const buttonContainer = inputContainer.createDiv({ cls: "nl-query-button-container" });
        this.submitBtn = buttonContainer.createEl("button", {
            cls: "nl-query-submit mod-cta",
            text: "Ask",
        });
        this.submitBtn.addEventListener("click", () => void this.submitQuery());

        // Example queries
        this.examplesEl = this.containerEl.createDiv({ cls: "nl-query-examples" });
        this.examplesEl.createEl("span", {
            cls: "nl-query-examples-label",
            text: "Try:",
        });

        for (const example of EXAMPLE_QUERIES) {
            const chip = this.examplesEl.createEl("button", {
                cls: "nl-query-example-chip",
                text: example.text,
            });
            chip.addEventListener("click", () => {
                this.inputEl.value = example.query;
                void this.submitQuery();
            });
        }

        // Results area
        this.resultsEl = this.containerEl.createDiv({ cls: "nl-query-results" });

        this.updateUIState();
    }

    /**
     * Update UI state based on service availability
     */
    private updateUIState(): void {
        if (!this.submitBtn) return;

        const isReady = this.nlQueryService?.isReady() ?? false;

        this.submitBtn.disabled = !isReady || this.isLoading;

        if (!isReady) {
            this.submitBtn.textContent = "Not configured";
            this.inputEl.placeholder = "Configure OpenRouter API key in settings to enable AI queries";
        } else if (this.isLoading) {
            this.submitBtn.textContent = "Thinking...";
        } else {
            this.submitBtn.textContent = "Ask";
            this.inputEl.placeholder = "e.g., How many cards did I review this week?";
        }
    }

    /**
     * Submit the query
     */
    private async submitQuery(): Promise<void> {
        const query = this.inputEl.value.trim();
        if (!query || !this.nlQueryService || this.isLoading) return;

        this.isLoading = true;
        this.updateUIState();

        // Show loading state in results
        this.resultsEl.empty();
        const loadingEl = this.resultsEl.createDiv({ cls: "nl-query-loading" });
        loadingEl.createEl("span", { text: "Analyzing your question..." });

        try {
            const result = await this.nlQueryService.query(query);
            this.renderResult(result);
        } catch (error) {
            this.renderError(error instanceof Error ? error.message : String(error));
        } finally {
            this.isLoading = false;
            this.updateUIState();
        }
    }

    /**
     * Render query result
     */
    private renderResult(result: NLQueryResult): void {
        this.resultsEl.empty();

        const resultContainer = this.resultsEl.createDiv({ cls: "nl-query-result" });

        // Question
        const questionEl = resultContainer.createDiv({ cls: "nl-query-result-question" });
        questionEl.createEl("strong", { text: "Q: " });
        questionEl.createEl("span", { text: result.question });

        // Answer
        const answerEl = resultContainer.createDiv({ cls: "nl-query-result-answer" });
        answerEl.createEl("strong", { text: "A: " });

        // Render answer as Markdown using Obsidian's MarkdownRenderer
        const answerContent = answerEl.createDiv({ cls: "nl-query-answer-content" });
        void MarkdownRenderer.render(
            this.app,
            result.answer,
            answerContent,
            "",
            this.component
        );

        // SQL queries (collapsible)
        if (result.intermediateSteps.length > 0) {
            const detailsEl = resultContainer.createEl("details", { cls: "nl-query-details" });
            detailsEl.createEl("summary", { text: `Show SQL queries (${result.intermediateSteps.length})` });

            const stepsEl = detailsEl.createDiv({ cls: "nl-query-steps" });
            for (const step of result.intermediateSteps) {
                if (step.action === "sql_db_query") {
                    const stepEl = stepsEl.createDiv({ cls: "nl-query-step" });
                    stepEl.createEl("code", {
                        cls: "nl-query-sql",
                        text: step.input,
                    });
                }
            }
        }

        // Error indicator
        if (result.error) {
            const errorEl = resultContainer.createDiv({ cls: "nl-query-error-indicator" });
            errorEl.createEl("span", { text: `Note: ${result.error}` });
        }
    }

    /**
     * Render error message
     */
    private renderError(message: string): void {
        this.resultsEl.empty();

        const errorEl = this.resultsEl.createDiv({ cls: "nl-query-error" });
        errorEl.createEl("strong", { text: "Error: " });
        errorEl.createEl("span", { text: message });
    }

    /**
     * Clear results
     */
    clear(): void {
        if (this.resultsEl) {
            this.resultsEl.empty();
        }
        if (this.inputEl) {
            this.inputEl.value = "";
        }
    }
}
