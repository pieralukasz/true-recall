/**
 * Natural Language Query Panel
 * UI component for asking questions about flashcard statistics in natural language
 */
import { MarkdownRenderer, type App, type Component } from "obsidian";
import type { NLQueryService } from "../../services/ai/nl-query.service";
import type { NLQueryResult, ExampleQuery } from "../../types";
import { StatsCard } from "./components/StatsCard";

/**
 * Example queries for the UI
 */
const EXAMPLE_QUERIES: ExampleQuery[] = [
    {
        text: "Today's progress",
        query: "Summarize my learning progress for today",
    },
    {
        text: "Weekly review",
        query: "How many cards did I review this week?",
    },
    {
        text: "Struggling cards",
        query: "Show me the top 10 cards with the most lapses",
    },
    {
        text: "Success rate",
        query: "What is my average success rate?",
    },
    {
        text: "New cards/day",
        query: "How many new cards have I learned per day this month?",
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
    private statsCard: StatsCard;

    // UI Elements
    private inputEl!: HTMLTextAreaElement;
    private submitBtn!: HTMLButtonElement;
    private resultsEl!: HTMLElement;
    private examplesEl!: HTMLElement;

    constructor(containerEl: HTMLElement, app: App, component: Component) {
        this.containerEl = containerEl;
        this.app = app;
        this.component = component;
        this.statsCard = new StatsCard(containerEl, {
            title: "Learning Insights",
            hoverLift: true,
        });
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

        // Render the card wrapper
        this.statsCard.render();
        const contentContainer = this.statsCard.getContentContainer();

        // Description
        contentContainer.createDiv({
            cls: "ep:text-ui-small ep:text-obs-muted ep:mb-3",
            text: "Explore your learning data with natural language questions.",
        });

        // Input area
        const inputContainer = contentContainer.createDiv({
            cls: "ep:flex ep:flex-col ep:gap-2 ep:mb-3",
        });

        this.inputEl = inputContainer.createEl("textarea", {
            cls: "ep:w-full ep:py-2.5 ep:px-3 ep:border ep:border-obs-border ep:rounded-md ep:bg-obs-primary ep:text-obs-normal ep:text-ui-small ep:resize-y ep:min-h-15 ep:focus:border-obs-interactive ep:focus:outline-none ep:placeholder:text-obs-faint",
            placeholder: "What would you like to know about your learning?",
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
        const buttonContainer = inputContainer.createDiv({
            cls: "ep:flex ep:justify-end",
        });
        this.submitBtn = buttonContainer.createEl("button", {
            cls: "mod-cta ep:py-2 ep:px-4 ep:text-ui-small ep:rounded-md ep:cursor-pointer ep:transition-opacity ep:disabled:opacity-50 ep:disabled:cursor-not-allowed",
            text: "Explore",
        });
        this.submitBtn.addEventListener("click", () => void this.submitQuery());

        // Example queries
        this.examplesEl = contentContainer.createDiv({
            cls: "ep:flex ep:flex-wrap ep:items-center ep:gap-2 ep:mb-4",
        });
        this.examplesEl.createEl("span", {
            cls: "ep:text-ui-smaller ep:text-obs-muted",
            text: "Quick insights:",
        });

        for (const example of EXAMPLE_QUERIES) {
            const chip = this.examplesEl.createEl("button", {
                cls: "ep:py-1 ep:px-2.5 ep:text-ui-smaller ep:border ep:border-obs-border ep:rounded-xl ep:bg-obs-primary ep:text-obs-muted ep:cursor-pointer ep:transition-all ep:hover:border-obs-interactive ep:hover:text-obs-normal",
                text: example.text,
            });
            chip.addEventListener("click", () => {
                this.inputEl.value = example.query;
                void this.submitQuery();
            });
        }

        // Results area
        this.resultsEl = contentContainer.createDiv({ cls: "ep:min-h-10" });

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
            this.submitBtn.textContent = "Analyzing...";
        } else {
            this.submitBtn.textContent = "Explore";
            this.inputEl.placeholder = "What would you like to know about your learning?";
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
        const loadingEl = this.resultsEl.createDiv({
            cls: "ep:flex ep:items-center ep:gap-2 ep:text-obs-muted ep:italic",
        });
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

        const resultContainer = this.resultsEl.createDiv({
            cls: "ep:bg-obs-primary ep:rounded-md ep:p-3",
        });

        // Question
        const questionEl = resultContainer.createDiv({
            cls: "ep:text-ui-small ep:text-obs-muted ep:mb-2",
        });
        questionEl.createEl("strong", { text: "Q: " });
        questionEl.createEl("span", { text: result.question });

        // Answer
        const answerEl = resultContainer.createDiv({
            cls: "ep:text-ui-small ep:text-obs-normal",
        });
        answerEl.createEl("strong", { text: "A: " });

        // Render answer as Markdown using Obsidian's MarkdownRenderer
        const answerContent = answerEl.createDiv({ cls: "ep:mt-1" });
        void MarkdownRenderer.render(
            this.app,
            result.answer,
            answerContent,
            "",
            this.component
        );

        // SQL queries (collapsible)
        if (result.intermediateSteps.length > 0) {
            const detailsEl = resultContainer.createEl("details", {
                cls: "ep:mt-3 ep:text-ui-smaller",
            });
            const summaryEl = detailsEl.createEl("summary", {
                text: `Show SQL queries (${result.intermediateSteps.length})`,
            });
            summaryEl.addClasses(["ep:text-obs-muted", "ep:cursor-pointer", "ep:py-1", "ep:hover:text-obs-normal"]);

            const stepsEl = detailsEl.createDiv({ cls: "ep:mt-2" });
            for (const step of result.intermediateSteps) {
                if (step.action === "sql_db_query") {
                    const stepEl = stepsEl.createDiv({ cls: "ep:mb-2" });
                    stepEl.createEl("code", {
                        cls: "ep:block ep:py-2 ep:px-3 ep:bg-obs-secondary ep:rounded ep:font-mono ep:text-ui-smaller ep:whitespace-pre-wrap ep:break-all ep:text-obs-muted",
                        text: step.input,
                    });
                }
            }
        }

        // Error indicator
        if (result.error) {
            const errorEl = resultContainer.createDiv({
                cls: "ep:mt-2 ep:text-ui-smaller ep:text-orange-500",
            });
            errorEl.createEl("span", { text: `Note: ${result.error}` });
        }
    }

    /**
     * Render error message
     */
    private renderError(message: string): void {
        this.resultsEl.empty();

        const errorEl = this.resultsEl.createDiv({
            cls: "ep:p-3 ep:bg-red-500/10 ep:border ep:border-red-500/30 ep:rounded-md ep:text-red-500",
        });
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
