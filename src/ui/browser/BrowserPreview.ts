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
        const empty = this.container.createDiv({
            cls: "ep:flex ep:flex-col ep:items-center ep:justify-center ep:h-full ep:py-10 ep:px-5 ep:text-obs-muted ep:text-center",
        });
        const iconEl = empty.createDiv({
            cls: "ep:text-[32px] ep:mb-3 ep:opacity-50",
        });
        setIcon(iconEl, "eye");
        empty.createDiv({
            text: "Select a card to preview",
            cls: "ep:text-[13px]",
        });
    }

    private renderHeader(card: BrowserCardItem): void {
        const header = this.container.createDiv({
            cls: "ep:flex ep:items-center ep:justify-between ep:py-3 ep:px-4 ep:border-b ep:border-obs-border ep:bg-obs-secondary ep:sticky ep:top-0 ep:z-10",
        });

        // Title (source note name or "Card Preview")
        header.createDiv({
            text: card.sourceNoteName || "Card Preview",
            cls: "ep:text-[13px] ep:font-semibold ep:text-obs-normal ep:overflow-hidden ep:text-ellipsis ep:whitespace-nowrap",
        });

        // Action buttons
        const actions = header.createDiv({
            cls: "ep:flex ep:items-center ep:gap-1 ep:shrink-0",
        });

        const actionBtnCls = "ep:flex ep:items-center ep:justify-center ep:w-7 ep:h-7 ep:p-0 ep:border-none ep:rounded-md ep:bg-transparent ep:text-obs-muted ep:cursor-pointer ep:transition-all ep:hover:bg-obs-modifier-hover ep:hover:text-obs-normal";
        const actionBtnActiveCls = "ep:bg-obs-interactive ep:text-on-accent ep:hover:bg-obs-interactive ep:hover:text-on-accent";
        const actionBtnDangerCls = "ep:text-obs-muted ep:hover:bg-red-500/10 ep:hover:text-obs-error";

        // Edit button
        const editBtn = actions.createEl("button", {
            cls: actionBtnCls,
            attr: { "aria-label": "Edit card" },
        });
        setIcon(editBtn, "edit");
        editBtn.addEventListener("click", () => this.props.onEdit(card));

        // Open source button (if available)
        if (card.sourceNotePath) {
            const sourceBtn = actions.createEl("button", {
                cls: actionBtnCls,
                attr: { "aria-label": "Open source note" },
            });
            setIcon(sourceBtn, "external-link");
            sourceBtn.addEventListener("click", () => this.props.onOpenSource(card));
        }

        // Suspend button
        const suspendBtnCls = card.suspended
            ? `${actionBtnCls} ${actionBtnActiveCls}`
            : actionBtnCls;
        const suspendBtn = actions.createEl("button", {
            cls: suspendBtnCls,
            attr: { "aria-label": card.suspended ? "Unsuspend" : "Suspend" },
        });
        setIcon(suspendBtn, card.suspended ? "play" : "pause");
        suspendBtn.addEventListener("click", () => this.props.onSuspend(card));

        // Bury button
        const isBuried = card.buriedUntil && new Date(card.buriedUntil) > new Date();
        const buryBtnCls = isBuried
            ? `${actionBtnCls} ${actionBtnActiveCls}`
            : actionBtnCls;
        const buryBtn = actions.createEl("button", {
            cls: buryBtnCls,
            attr: { "aria-label": isBuried ? "Unbury" : "Bury" },
        });
        setIcon(buryBtn, isBuried ? "archive-restore" : "archive");
        buryBtn.addEventListener("click", () => this.props.onBury(card));

        // Delete button
        const deleteBtn = actions.createEl("button", {
            cls: `${actionBtnCls} ${actionBtnDangerCls}`,
            attr: { "aria-label": "Delete card" },
        });
        setIcon(deleteBtn, "trash-2");
        deleteBtn.addEventListener("click", () => this.props.onDelete(card));
    }

    private renderContent(card: BrowserCardItem): void {
        const content = this.container.createDiv({
            cls: "ep:flex-1 ep:overflow-y-auto ep:p-4",
        });

        const sectionLabelCls = "ep:block ep:mb-2 ep:text-obs-muted ep:text-[11px] ep:font-semibold ep:uppercase ep:tracking-[0.5px]";
        const sectionContentCls = "ep:p-3 ep:bg-obs-secondary ep:rounded-lg ep:text-obs-normal ep:text-sm ep:leading-relaxed markdown-rendered";

        // Question section
        const questionSection = content.createDiv({ cls: "ep:mb-4" });
        questionSection.createDiv({ text: "Question", cls: sectionLabelCls });
        const questionContent = questionSection.createDiv({ cls: sectionContentCls });
        void MarkdownRenderer.render(
            this.props.app,
            card.question ?? "",
            questionContent,
            card.sourceNotePath || "",
            this.props.component
        );

        // Divider
        content.createDiv({ cls: "ep:h-px ep:my-4 ep:bg-obs-border" });

        // Answer section
        const answerSection = content.createDiv({ cls: "ep:mb-4" });
        answerSection.createDiv({ text: "Answer", cls: sectionLabelCls });
        const answerContent = answerSection.createDiv({ cls: sectionContentCls });
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
            cls: "ep:mt-4 ep:pt-4 ep:border-t ep:border-obs-border ep:mx-4 ep:mb-4",
        });

        const infoRowCls = "ep:flex ep:items-start ep:py-1.5 ep:border-b ep:border-obs-border last:ep:border-b-0";
        const infoLabelCls = "ep:shrink-0 ep:min-w-[80px] ep:mr-3 ep:text-obs-muted ep:text-xs";
        const infoValueCls = "ep:text-obs-normal ep:text-[13px]";

        // State badge
        const stateRow = info.createDiv({ cls: infoRowCls });
        stateRow.createSpan({ text: "State:", cls: infoLabelCls });
        this.renderStateBadge(stateRow, card);

        // Due date
        const dueRow = info.createDiv({ cls: infoRowCls });
        dueRow.createSpan({ text: "Due:", cls: infoLabelCls });
        dueRow.createSpan({
            text: this.formatDueDate(card.due),
            cls: infoValueCls,
        });

        // FSRS stats
        const statsRow = info.createDiv({
            cls: "ep:flex ep:flex-wrap ep:gap-2 ep:py-2 ep:border-b ep:border-obs-border",
        });

        this.renderStat(statsRow, "Stability", `${Math.round(card.stability)}d`);
        this.renderStat(statsRow, "Difficulty", card.difficulty.toFixed(2));
        this.renderStat(statsRow, "Reps", String(card.reps));
        this.renderStat(statsRow, "Lapses", String(card.lapses));

        // Projects
        if (card.projects.length > 0) {
            const projectsRow = info.createDiv({ cls: infoRowCls });
            projectsRow.createSpan({ text: "Projects:", cls: infoLabelCls });
            const projectsContainer = projectsRow.createDiv({
                cls: "ep:flex ep:flex-wrap ep:gap-1",
            });
            for (const project of card.projects) {
                projectsContainer.createSpan({
                    text: project,
                    cls: "ep:py-0.5 ep:px-2 ep:bg-obs-modifier-hover ep:rounded ep:text-xs ep:text-obs-muted",
                });
            }
        }

        // Created date
        if (card.createdAt) {
            const createdRow = info.createDiv({ cls: infoRowCls });
            createdRow.createSpan({ text: "Created:", cls: infoLabelCls });
            createdRow.createSpan({
                text: new Date(card.createdAt).toLocaleDateString(),
                cls: infoValueCls,
            });
        }

        // Last review
        if (card.lastReview) {
            const reviewRow = info.createDiv({ cls: infoRowCls });
            reviewRow.createSpan({ text: "Last Review:", cls: infoLabelCls });
            reviewRow.createSpan({
                text: new Date(card.lastReview).toLocaleDateString(),
                cls: infoValueCls,
            });
        }
    }

    private renderStateBadge(container: HTMLElement, card: BrowserCardItem): void {
        const now = new Date();
        let label: string;
        let colorCls: string;

        const baseCls = "ep:inline-flex ep:items-center ep:py-0.5 ep:px-2 ep:rounded-xl ep:text-[11px] ep:font-semibold ep:uppercase ep:tracking-[0.3px]";

        if (card.suspended) {
            label = "Suspended";
            colorCls = "ep:bg-red-500/15 ep:text-obs-error";
        } else if (card.buriedUntil && new Date(card.buriedUntil) > now) {
            label = "Buried";
            colorCls = "ep:bg-obs-modifier-hover ep:text-obs-muted";
        } else {
            switch (card.state) {
                case State.New:
                    label = "New";
                    colorCls = "ep:bg-blue-500/15 ep:text-blue-500";
                    break;
                case State.Learning:
                    label = "Learning";
                    colorCls = "ep:bg-orange-500/15 ep:text-orange-500";
                    break;
                case State.Review:
                    label = "Review";
                    colorCls = "ep:bg-green-500/15 ep:text-green-500";
                    break;
                case State.Relearning:
                    label = "Relearning";
                    colorCls = "ep:bg-yellow-500/15 ep:text-yellow-500";
                    break;
                default:
                    label = "Unknown";
                    colorCls = "ep:bg-obs-modifier-hover ep:text-obs-muted";
            }
        }

        container.createSpan({
            text: label,
            cls: `${baseCls} ${colorCls}`,
        });
    }

    private renderStat(container: HTMLElement, label: string, value: string): void {
        const stat = container.createDiv({
            cls: "ep:flex ep:flex-col ep:py-2 ep:px-3 ep:bg-obs-secondary ep:rounded-md ep:min-w-[70px]",
        });
        stat.createSpan({
            text: label,
            cls: "ep:text-[10px] ep:font-semibold ep:text-obs-muted ep:uppercase ep:tracking-[0.3px] ep:mb-0.5",
        });
        stat.createSpan({
            text: value,
            cls: "ep:text-sm ep:font-semibold ep:text-obs-normal",
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

    destroy(): void {
        // Cleanup if needed
    }
}
