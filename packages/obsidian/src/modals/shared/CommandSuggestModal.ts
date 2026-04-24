import { type App, FuzzySuggestModal } from "obsidian";

interface ObsidianCommand {
	id: string;
	name: string;
}

export class CommandSuggestModal extends FuzzySuggestModal<ObsidianCommand> {
	private resolve: ((cmd: ObsidianCommand | null) => void) | null = null;
	private selected: ObsidianCommand | null = null;
	private excludeIds: Set<string>;

	constructor(app: App, excludeIds: string[] = []) {
		super(app);
		this.excludeIds = new Set(excludeIds);
		this.setPlaceholder("Search commands...");
	}

	openAndWait(): Promise<ObsidianCommand | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onClose(): void {
		// Obsidian's selectSuggestion internally calls close() BEFORE
		// onChooseSuggestion/onChooseItem, so onClose fires first with
		// selected still null. Defer the resolve via queueMicrotask so the
		// synchronous onChooseItem that follows has a chance to set selected.
		const capturedResolve = this.resolve;
		this.resolve = null;
		queueMicrotask(() => {
			capturedResolve?.(this.selected);
		});
	}

	getItems(): ObsidianCommand[] {
		const commands = (this.app as any).commands.commands as Record<
			string,
			ObsidianCommand
		>;
		return Object.values(commands).filter(
			(cmd) => !this.excludeIds.has(cmd.id),
		);
	}

	getItemText(item: ObsidianCommand): string {
		return item.name;
	}

	onChooseItem(item: ObsidianCommand): void {
		this.selected = item;
	}
}
