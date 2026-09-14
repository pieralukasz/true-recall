import type TrueRecallPlugin from "@true-recall/obsidian/main";

import { G } from "../../data/queries";

export class AssistantRepository {
	constructor(private plugin: TrueRecallPlugin) {}

	actions() {
		const store = this.plugin.cardStore;
		if (!store) throw new Error("Card store not ready");
		return store.assistantTasks;
	}

	threadActions() {
		const store = this.plugin.cardStore;
		if (!store) throw new Error("Card store not ready");
		return store.assistantThreads;
	}

	invalidate(): void {
		this.plugin.dataLayer?.invalidateGroups([G.ASSISTANT]);
	}

	assistantMessage(content: string, createdAt: number) {
		return {
			id: crypto.randomUUID(),
			role: "assistant" as const,
			content,
			createdAt,
		};
	}
}
