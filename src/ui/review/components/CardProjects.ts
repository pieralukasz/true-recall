/**
 * Card Projects Component
 * Renders project badges with expandable toggle
 */

export interface CardProjectsCallbacks {
	onToggleProjects: (cardId: string) => void;
	onOpenProject: (project: string) => void;
}

/**
 * Renders project badges for a card
 * Supports collapsed (show count) and expanded (show badges) states
 */
export class CardProjects {
	constructor(private readonly callbacks: CardProjectsCallbacks) {}

	/**
	 * Render project badges or toggle
	 * @param container Parent element to render into
	 * @param cardId The card ID (for toggle state tracking)
	 * @param projects Array of project names
	 * @param isExpanded Whether projects are expanded
	 */
	render(
		container: HTMLElement,
		cardId: string,
		projects: string[] | undefined,
		isExpanded: boolean
	): void {
		if (!projects || projects.length === 0) return;

		const projectsContainer = container.createDiv({
			cls: "ep:mt-6 ep:flex ep:flex-col ep:items-center",
		});

		if (!isExpanded) {
			this.renderCollapsed(projectsContainer, cardId, projects.length);
		} else {
			this.renderExpanded(projectsContainer, projects);
		}
	}

	private renderCollapsed(
		container: HTMLElement,
		cardId: string,
		count: number
	): void {
		const toggleEl = container.createEl("span", {
			text: `Show projects (${count})`,
			cls: "ep:text-ui-small ep:text-obs-muted ep:cursor-pointer ep:hover:text-obs-normal ep:hover:underline ep:transition-colors",
			attr: { "data-action": "toggle-projects", "data-card-id": cardId },
		});

		toggleEl.addEventListener("click", () => {
			this.callbacks.onToggleProjects(cardId);
		});
	}

	private renderExpanded(container: HTMLElement, projects: string[]): void {
		const projectsEl = container.createDiv({
			cls: "ep:flex ep:flex-wrap ep:justify-center ep:gap-1.5",
		});

		for (const project of projects) {
			const badgeEl = projectsEl.createEl("span", {
				text: project,
				cls: "ep:py-0.5 ep:px-2 ep:text-ui-smaller ep:border ep:border-obs-border ep:rounded-xl ep:bg-obs-primary ep:text-obs-muted ep:cursor-pointer ep:transition-all ep:hover:border-obs-interactive ep:hover:text-obs-normal",
				attr: { "data-action": "open-project", "data-project": project },
			});

			badgeEl.addEventListener("click", () => {
				this.callbacks.onOpenProject(project);
			});
		}
	}
}
