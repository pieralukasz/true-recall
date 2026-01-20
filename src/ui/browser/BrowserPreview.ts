/**
 * Browser Preview
 * Card preview panel with content display and quick actions
 */
import { App, Component, MarkdownRenderer, setIcon } from "obsidian";
import { State } from "ts-fsrs";
import type { BrowserCardItem } from "../../types/browser.types";

export interface BrowserPreviewProps {
    card: BrowserCardItem | null;
    app: App;
    component: Component;
    onEdit: (card: BrowserCardItem) => void;
    onOpenSource: (card: BrowserCardItem) => void;
    onSuspend: (card: BrowserCardItem) => void;
    onBury: (card: BrowserCardItem) => void;
    onDelete: (card: BrowserCardItem) => void;
}

/**
 * Preview panel component
 */
export class BrowserPreview {
    private container: HTMLElement;
    private props: BrowserPreviewProps;

    constructor(container: HTMLElement, props: BrowserPreviewProps) {
        this.container = container;
        this.props = props;
    }

    render(): void {
        this.container.empty();
        this.container.addClass("browser-preview");

        const { card } = this.props;

        if (!card) {
            this.renderEmpty();
            return;
        }

        // Header with actions
        this.renderHeader(card);

        // Content
        this.renderContent(card);

        // Info section
        this.renderInfo(card);
    }

    private renderEmpty(): void {
        const empty = this.container.createDiv({ cls: "preview-empty" });
        const iconEl = empty.createDiv({ cls: "empty-icon" });
        setIcon(iconEl, "eye");
        empty.createDiv({ text: "Select a card to preview", cls: "empty-text" });
    }

    private renderHeader(card: BrowserCardItem): void {
        const header = this.container.createDiv({ cls: "preview-header" });

        // Title (source note name or "Card Preview")
        header.createDiv({
            text: card.sourceNoteName || "Card Preview",
            cls: "preview-title",
        });

        // Action buttons
        const actions = header.createDiv({ cls: "preview-actions" });

        // Edit button
        const editBtn = actions.createEl("button", {
            cls: "action-btn",
            attr: { "aria-label": "Edit card" },
        });
        setIcon(editBtn, "edit");
        editBtn.addEventListener("click", () => this.props.onEdit(card));

        // Open source button (if available)
        if (card.sourceNotePath) {
            const sourceBtn = actions.createEl("button", {
                cls: "action-btn",
                attr: { "aria-label": "Open source note" },
            });
            setIcon(sourceBtn, "external-link");
            sourceBtn.addEventListener("click", () => this.props.onOpenSource(card));
        }

        // Suspend button
        const suspendBtn = actions.createEl("button", {
            cls: `action-btn${card.suspended ? " is-active" : ""}`,
            attr: { "aria-label": card.suspended ? "Unsuspend" : "Suspend" },
        });
        setIcon(suspendBtn, card.suspended ? "play" : "pause");
        suspendBtn.addEventListener("click", () => this.props.onSuspend(card));

        // Bury button
        const isBuried = card.buriedUntil && new Date(card.buriedUntil) > new Date();
        const buryBtn = actions.createEl("button", {
            cls: `action-btn${isBuried ? " is-active" : ""}`,
            attr: { "aria-label": isBuried ? "Unbury" : "Bury" },
        });
        setIcon(buryBtn, isBuried ? "archive-restore" : "archive");
        buryBtn.addEventListener("click", () => this.props.onBury(card));

        // Delete button
        const deleteBtn = actions.createEl("button", {
            cls: "action-btn is-danger",
            attr: { "aria-label": "Delete card" },
        });
        setIcon(deleteBtn, "trash-2");
        deleteBtn.addEventListener("click", () => this.props.onDelete(card));
    }

    private renderContent(card: BrowserCardItem): void {
        const content = this.container.createDiv({ cls: "preview-content" });

        // Question section
        const questionSection = content.createDiv({ cls: "content-section" });
        questionSection.createDiv({ text: "Question", cls: "section-label" });
        const questionContent = questionSection.createDiv({ cls: "section-content markdown-rendered" });
        void MarkdownRenderer.render(
            this.props.app,
            card.question ?? "",
            questionContent,
            card.sourceNotePath || "",
            this.props.component
        );

        // Divider
        content.createDiv({ cls: "content-divider" });

        // Answer section
        const answerSection = content.createDiv({ cls: "content-section" });
        answerSection.createDiv({ text: "Answer", cls: "section-label" });
        const answerContent = answerSection.createDiv({ cls: "section-content markdown-rendered" });
        void MarkdownRenderer.render(
            this.props.app,
            card.answer ?? "",
            answerContent,
            card.sourceNotePath || "",
            this.props.component
        );
    }

    private renderInfo(card: BrowserCardItem): void {
        const info = this.container.createDiv({ cls: "preview-info" });

        // State badge
        const stateRow = info.createDiv({ cls: "info-row" });
        stateRow.createSpan({ text: "State:", cls: "info-label" });
        this.renderStateBadge(stateRow, card);

        // Due date
        const dueRow = info.createDiv({ cls: "info-row" });
        dueRow.createSpan({ text: "Due:", cls: "info-label" });
        dueRow.createSpan({
            text: this.formatDueDate(card.due),
            cls: "info-value",
        });

        // FSRS stats
        const statsRow = info.createDiv({ cls: "info-row info-stats" });

        this.renderStat(statsRow, "Stability", `${Math.round(card.stability)}d`);
        this.renderStat(statsRow, "Difficulty", card.difficulty.toFixed(2));
        this.renderStat(statsRow, "Reps", String(card.reps));
        this.renderStat(statsRow, "Lapses", String(card.lapses));

        // Projects
        if (card.projects.length > 0) {
            const projectsRow = info.createDiv({ cls: "info-row" });
            projectsRow.createSpan({ text: "Projects:", cls: "info-label" });
            const projectsContainer = projectsRow.createDiv({ cls: "info-tags" });
            for (const project of card.projects) {
                projectsContainer.createSpan({ text: project, cls: "info-tag" });
            }
        }

        // Tags
        if (card.tags && card.tags.length > 0) {
            const tagsRow = info.createDiv({ cls: "info-row" });
            tagsRow.createSpan({ text: "Tags:", cls: "info-label" });
            const tagsContainer = tagsRow.createDiv({ cls: "info-tags" });
            for (const tag of card.tags) {
                tagsContainer.createSpan({ text: tag, cls: "info-tag" });
            }
        }

        // Created date
        if (card.createdAt) {
            const createdRow = info.createDiv({ cls: "info-row" });
            createdRow.createSpan({ text: "Created:", cls: "info-label" });
            createdRow.createSpan({
                text: new Date(card.createdAt).toLocaleDateString(),
                cls: "info-value",
            });
        }

        // Last review
        if (card.lastReview) {
            const reviewRow = info.createDiv({ cls: "info-row" });
            reviewRow.createSpan({ text: "Last Review:", cls: "info-label" });
            reviewRow.createSpan({
                text: new Date(card.lastReview).toLocaleDateString(),
                cls: "info-value",
            });
        }
    }

    private renderStateBadge(container: HTMLElement, card: BrowserCardItem): void {
        const now = new Date();
        let label: string;
        let cls: string;

        if (card.suspended) {
            label = "Suspended";
            cls = "state-suspended";
        } else if (card.buriedUntil && new Date(card.buriedUntil) > now) {
            label = "Buried";
            cls = "state-buried";
        } else {
            switch (card.state) {
                case State.New:
                    label = "New";
                    cls = "state-new";
                    break;
                case State.Learning:
                    label = "Learning";
                    cls = "state-learning";
                    break;
                case State.Review:
                    label = "Review";
                    cls = "state-review";
                    break;
                case State.Relearning:
                    label = "Relearning";
                    cls = "state-relearning";
                    break;
                default:
                    label = "Unknown";
                    cls = "state-unknown";
            }
        }

        container.createSpan({
            text: label,
            cls: `state-badge ${cls}`,
        });
    }

    private renderStat(container: HTMLElement, label: string, value: string): void {
        const stat = container.createDiv({ cls: "stat-item" });
        stat.createSpan({ text: label, cls: "stat-label" });
        stat.createSpan({ text: value, cls: "stat-value" });
    }

    private formatDueDate(due: string): string {
        const dueDate = new Date(due);
        const now = new Date();
        const diffMs = dueDate.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        const dateStr = dueDate.toLocaleDateString();

        if (diffDays < 0) {
            return `${dateStr} (${Math.abs(diffDays)} days overdue)`;
        } else if (diffDays === 0) {
            return `${dateStr} (today)`;
        } else if (diffDays === 1) {
            return `${dateStr} (tomorrow)`;
        } else {
            return `${dateStr} (in ${diffDays} days)`;
        }
    }

    destroy(): void {
        // Cleanup if needed
    }
}
