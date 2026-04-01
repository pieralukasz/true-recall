import { type App, FuzzySuggestModal } from "obsidian";

interface ObsidianCommand {
	id: string;
	name: string;
}

export class CommandSuggestModal extends FuzzySuggestModal<ObsidianCommand> {
	private resolve: ((cmd: ObsidianCommand | null) => void) | null = null;
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
		this.resolve?.(null);
		this.resolve = null;
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
		this.resolve?.(item);
		this.resolve = null;
	}
}
