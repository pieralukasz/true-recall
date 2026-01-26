/**
 * Selection Footer Component
 * Shows selected count and bulk action buttons
 */
import { BaseComponent } from "../component.base";

export interface SelectionFooterProps {
    selectedCount: number;
    onMove?: () => void;
    onDelete?: () => void;
}

/**
 * Footer for selection mode with bulk actions
 */
export class SelectionFooter extends BaseComponent {
    private props: SelectionFooterProps;

    constructor(container: HTMLElement, props: SelectionFooterProps) {
        super(container);
        this.props = props;
    }

    render(): void {
        if (this.element) {
            this.element.remove();
            this.events.cleanup();
        }

        const { selectedCount, onMove, onDelete } = this.props;

        this.element = this.container.createDiv({
            cls: "ep:flex ep:items-center ep:justify-between ep:py-2 ep:px-2 ep:border-t ep:border-obs-border ep:bg-obs-secondary",
        });

        // Left side: selected count
        this.element.createSpan({
            text: `Selected: ${selectedCount}`,
            cls: "ep:text-sm ep:text-obs-normal ep:font-medium",
        });

        // Right side: action buttons
        const actionsEl = this.element.createDiv({
            cls: "ep:flex ep:items-center ep:gap-2",
        });

        const btnBase = "ep:flex ep:items-center ep:gap-1 ep:px-3 ep:py-1.5 ep:rounded ep:text-sm ep:font-medium ep:border-none ep:cursor-pointer ep:transition-colors";

        // Move button
        if (onMove) {
            const moveBtn = actionsEl.createEl("button", {
                cls: `${btnBase} ep:bg-obs-modifier-hover ep:text-obs-normal ep:hover:bg-obs-interactive ep:hover:text-white`,
            });
            moveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg>`;
            moveBtn.createSpan({ text: "Move" });

            if (selectedCount === 0) {
                moveBtn.disabled = true;
                moveBtn.classList.add("ep:opacity-50", "ep:cursor-not-allowed");
            } else {
                this.events.addEventListener(moveBtn, "click", () => onMove());
            }
        }

        // Delete button
        if (onDelete) {
            const deleteBtn = actionsEl.createEl("button", {
                cls: `${btnBase} ep:bg-red-500/10 ep:text-red-500 ep:hover:bg-red-500 ep:hover:text-white`,
            });
            deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>`;
            deleteBtn.createSpan({ text: "Delete" });

            if (selectedCount === 0) {
                deleteBtn.disabled = true;
                deleteBtn.classList.add("ep:opacity-50", "ep:cursor-not-allowed");
            } else {
                this.events.addEventListener(deleteBtn, "click", () => onDelete());
            }
        }
    }

    updateProps(props: Partial<SelectionFooterProps>): void {
        this.props = { ...this.props, ...props };
        this.render();
    }
}

export function createSelectionFooter(
    container: HTMLElement,
    props: SelectionFooterProps
): SelectionFooter {
    const footer = new SelectionFooter(container, props);
    footer.render();
    return footer;
}
