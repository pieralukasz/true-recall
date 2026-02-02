/**
 * Browser Preview
 * Card preview panel with content display and quick actions
 */
import { App, Component, MarkdownRenderer, setIcon } from "obsidian";
import { State } from "ts-fsrs";
import type { BrowserCardItem } from "../../types/browser.types";
import { BaseComponent } from "./BaseComponent";
import { PREVIEW_STYLES } from "./styles";

export interface BrowserPreviewProps {
    card: BrowserCardItem | null;
    app: App;
    component: Component;
}

export interface BrowserPreviewCallbacks {
    onEdit: (card: BrowserCardItem) => void;
    onOpenSource: (card: BrowserCardItem) => void;
    onSuspend: (card: BrowserCardItem) => void;
    onBury: (card: BrowserCardItem) => void;
    onDelete: (card: BrowserCardItem) => void;
}

/**
 * Preview panel component
 */
export class BrowserPreview extends BaseComponent<BrowserPreviewProps, BrowserPreviewCallbacks> {
    // Cached card ID to avoid re-rendering when unchanged
    private lastRenderedCardId: string | null = null;

    // Cached DOM references
    private contentContainer: HTMLElement | null = null;
    private headerActionsContainer: HTMLElement | null = null;

    constructor(
        container: HTMLElement,
        props: BrowserPreviewProps,
        callbacks: BrowserPreviewCallbacks
    ) {
        super(container, props, callbacks);
    }

    render(): void {
        this.container.empty();

        const { card } = this.props;

        if (!card) {
            this.renderEmpty();
            this.lastRenderedCardId = null;
            this.isRendered = true;
            return;
        }

        // Header with actions
        this.renderHeader(card);

        // Content
        this.contentContainer = this.container.createDiv({
            cls: PREVIEW_STYLES.CONTENT,
        });
        this.renderContent(card);

        // Info section
        this.renderInfo(card);

        this.lastRenderedCardId = card.id;
        this.isRendered = true;
    }

    /**
     * Handle incremental updates
     * For preview, if card ID changed we need full re-render
     */
    protected onUpdate(changedKeys: (keyof BrowserPreviewProps)[]): void {
        if (!changedKeys.includes("card")) return;

        const { card } = this.props;

        // If card changed to different card or null, full re-render
        if (card?.id !== this.lastRenderedCardId) {
            this.render();
            return;
        }

        // Same card but content may have changed - update content and header
        if (card && this.contentContainer) {
            this.contentContainer.empty();
            this.renderContent(card);
        }

        if (card && this.headerActionsContainer) {
            this.updateHeaderActions(card);
        }
    }

    private renderEmpty(): void {
        const empty = this.container.createDiv({
            cls: PREVIEW_STYLES.EMPTY,
        });
        const iconEl = empty.createDiv({
            cls: PREVIEW_STYLES.EMPTY_ICON,
        });
        setIcon(iconEl, "eye");
        empty.createDiv({
            text: "Select a card to preview",
            cls: PREVIEW_STYLES.EMPTY_TEXT,
        });
    }

    private renderHeader(card: BrowserCardItem): void {
        const header = this.container.createDiv({
            cls: PREVIEW_STYLES.HEADER,
        });

        // Title (source note name or "Card Preview")
        header.createDiv({
            text: card.sourceNoteName || "Card Preview",
            cls: PREVIEW_STYLES.HEADER_TITLE,
        });

        // Action buttons
        this.headerActionsContainer = header.createDiv({
            cls: PREVIEW_STYLES.HEADER_ACTIONS,
        });
        this.updateHeaderActions(card);
    }

    private updateHeaderActions(card: BrowserCardItem): void {
        if (!this.headerActionsContainer) return;
        this.headerActionsContainer.empty();

        // Edit button
        const editBtn = this.headerActionsContainer.createEl("button", {
            cls: PREVIEW_STYLES.ACTION_BTN,
            attr: { "aria-label": "Edit card" },
        });
        setIcon(editBtn, "edit");
        editBtn.addEventListener("click", () => this.callbacks.onEdit(card));

        // Open source button (if available)
        if (card.sourceNotePath) {
            const sourceBtn = this.headerActionsContainer.createEl("button", {
                cls: PREVIEW_STYLES.ACTION_BTN,
                attr: { "aria-label": "Open source note" },
            });
            setIcon(sourceBtn, "external-link");
            sourceBtn.addEventListener("click", () => this.callbacks.onOpenSource(card));
        }

        // Suspend button
        const suspendBtnCls = card.suspended
            ? `${PREVIEW_STYLES.ACTION_BTN} ${PREVIEW_STYLES.ACTION_BTN_ACTIVE}`
            : PREVIEW_STYLES.ACTION_BTN;
        const suspendBtn = this.headerActionsContainer.createEl("button", {
            cls: suspendBtnCls,
            attr: { "aria-label": card.suspended ? "Unsuspend" : "Suspend" },
        });
        setIcon(suspendBtn, card.suspended ? "play" : "pause");
        suspendBtn.addEventListener("click", () => this.callbacks.onSuspend(card));

        // Bury button
        const isBuried = card.buriedUntil && new Date(card.buriedUntil) > new Date();
        const buryBtnCls = isBuried
            ? `${PREVIEW_STYLES.ACTION_BTN} ${PREVIEW_STYLES.ACTION_BTN_ACTIVE}`
            : PREVIEW_STYLES.ACTION_BTN;
        const buryBtn = this.headerActionsContainer.createEl("button", {
            cls: buryBtnCls,
            attr: { "aria-label": isBuried ? "Unbury" : "Bury" },
        });
        setIcon(buryBtn, isBuried ? "archive-restore" : "archive");
        buryBtn.addEventListener("click", () => this.callbacks.onBury(card));

        // Delete button
        const deleteBtn = this.headerActionsContainer.createEl("button", {
            cls: `${PREVIEW_STYLES.ACTION_BTN} ${PREVIEW_STYLES.ACTION_BTN_DANGER}`,
            attr: { "aria-label": "Delete card" },
        });
        setIcon(deleteBtn, "trash-2");
        deleteBtn.addEventListener("click", () => this.callbacks.onDelete(card));
    }

    private renderContent(card: BrowserCardItem): void {
        if (!this.contentContainer) return;

        // Question section
        const questionSection = this.contentContainer.createDiv({ cls: "ep:mb-4" });
        questionSection.createDiv({ text: "Question", cls: PREVIEW_STYLES.SECTION_LABEL });
        const questionContent = questionSection.createDiv({ cls: PREVIEW_STYLES.SECTION_CONTENT });
        void MarkdownRenderer.render(
            this.props.app,
            card.question ?? "",
            questionContent,
            card.sourceNotePath || "",
            this.props.component
        );

        // Divider
        this.contentContainer.createDiv({ cls: PREVIEW_STYLES.DIVIDER });

        // Answer section
        const answerSection = this.contentContainer.createDiv({ cls: "ep:mb-4" });
        answerSection.createDiv({ text: "Answer", cls: PREVIEW_STYLES.SECTION_LABEL });
        const answerContent = answerSection.createDiv({ cls: PREVIEW_STYLES.SECTION_CONTENT });
        void MarkdownRenderer.render(
            this.props.app,
            card.answer ?? "",
            answerContent,
            card.sourceNotePath || "",
            this.props.component
        );
    }

    private renderInfo(card: BrowserCardItem): void {
        const info = this.container.createDiv({
            cls: PREVIEW_STYLES.INFO,
        });

        // State badge
        const stateRow = info.createDiv({ cls: PREVIEW_STYLES.INFO_ROW });
        stateRow.createSpan({ text: "State:", cls: PREVIEW_STYLES.INFO_LABEL });
        this.renderStateBadge(stateRow, card);

        // Due date
        const dueRow = info.createDiv({ cls: PREVIEW_STYLES.INFO_ROW });
        dueRow.createSpan({ text: "Due:", cls: PREVIEW_STYLES.INFO_LABEL });
        dueRow.createSpan({
            text: this.formatDueDate(card.due),
            cls: PREVIEW_STYLES.INFO_VALUE,
        });

        // FSRS stats
        const statsRow = info.createDiv({
            cls: PREVIEW_STYLES.STATS_ROW,
        });

        this.renderStat(statsRow, "Stability", `${Math.round(card.stability)}d`);
        this.renderStat(statsRow, "Difficulty", card.difficulty.toFixed(2));
        this.renderStat(statsRow, "Reps", String(card.reps));
        this.renderStat(statsRow, "Lapses", String(card.lapses));

        // Projects
        if (card.projects.length > 0) {
            const projectsRow = info.createDiv({ cls: PREVIEW_STYLES.INFO_ROW });
            projectsRow.createSpan({ text: "Projects:", cls: PREVIEW_STYLES.INFO_LABEL });
            const projectsContainer = projectsRow.createDiv({
                cls: "ep:flex ep:flex-wrap ep:gap-1",
            });
            for (const project of card.projects) {
                projectsContainer.createSpan({
                    text: project,
                    cls: PREVIEW_STYLES.PROJECT_TAG,
                });
            }
        }

        // Created date
        if (card.createdAt) {
            const createdRow = info.createDiv({ cls: PREVIEW_STYLES.INFO_ROW });
            createdRow.createSpan({ text: "Created:", cls: PREVIEW_STYLES.INFO_LABEL });
            createdRow.createSpan({
                text: new Date(card.createdAt).toLocaleDateString(),
                cls: PREVIEW_STYLES.INFO_VALUE,
            });
        }

        // Last review
        if (card.lastReview) {
            const reviewRow = info.createDiv({ cls: PREVIEW_STYLES.INFO_ROW });
            reviewRow.createSpan({ text: "Last Review:", cls: PREVIEW_STYLES.INFO_LABEL });
            reviewRow.createSpan({
                text: new Date(card.lastReview).toLocaleDateString(),
                cls: PREVIEW_STYLES.INFO_VALUE,
            });
        }
    }

    private renderStateBadge(container: HTMLElement, card: BrowserCardItem): void {
        const now = new Date();
        let label: string;
        let badgeCls: string;

        if (card.suspended) {
            label = "Suspended";
            badgeCls = `${PREVIEW_STYLES.BADGE_BASE} ${PREVIEW_STYLES.BADGE_SUSPENDED}`;
        } else if (card.buriedUntil && new Date(card.buriedUntil) > now) {
            label = "Buried";
            badgeCls = `${PREVIEW_STYLES.BADGE_BASE} ${PREVIEW_STYLES.BADGE_BURIED}`;
        } else {
            switch (card.state) {
                case State.New:
                    label = "New";
                    badgeCls = `${PREVIEW_STYLES.BADGE_BASE} ${PREVIEW_STYLES.BADGE_NEW}`;
                    break;
                case State.Learning:
                    label = "Learning";
                    badgeCls = `${PREVIEW_STYLES.BADGE_BASE} ${PREVIEW_STYLES.BADGE_LEARNING}`;
                    break;
                case State.Review:
                    label = "Review";
                    badgeCls = `${PREVIEW_STYLES.BADGE_BASE} ${PREVIEW_STYLES.BADGE_REVIEW}`;
                    break;
                case State.Relearning:
                    label = "Relearning";
                    badgeCls = `${PREVIEW_STYLES.BADGE_BASE} ${PREVIEW_STYLES.BADGE_RELEARNING}`;
                    break;
                default:
                    label = "Unknown";
                    badgeCls = `${PREVIEW_STYLES.BADGE_BASE} ${PREVIEW_STYLES.BADGE_UNKNOWN}`;
            }
        }

        container.createSpan({
            text: label,
            cls: badgeCls,
        });
    }

    private renderStat(container: HTMLElement, label: string, value: string): void {
        const stat = container.createDiv({
            cls: PREVIEW_STYLES.STAT_BOX,
        });
        stat.createSpan({
            text: label,
            cls: PREVIEW_STYLES.STAT_LABEL,
        });
        stat.createSpan({
            text: value,
            cls: PREVIEW_STYLES.STAT_VALUE,
        });
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

    override destroy(): void {
        this.contentContainer = null;
        this.headerActionsContainer = null;
        this.lastRenderedCardId = null;
        super.destroy();
    }
}
