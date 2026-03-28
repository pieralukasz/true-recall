import type { ChatTurn, RagQueryService } from "./rag-query.service";

export class RagChatService {
	private history: ChatTurn[] = [];

	constructor(private queryService: RagQueryService) {}

	async *sendMessage(message: string): AsyncGenerator<string> {
		this.history.push({
			role: "user",
			content: message,
			timestamp: Date.now(),
		});

		let fullResponse = "";
		for await (const chunk of this.queryService.queryStream(
			message,
			this.history,
		)) {
			fullResponse += chunk;
			yield chunk;
		}

		const sources = await this.queryService.getLastSearchResults(message);
		this.history.push({
			role: "assistant",
			content: fullResponse,
			sources,
			timestamp: Date.now(),
		});
	}

	clearHistory(): void {
		this.history = [];
	}

	getHistory(): ChatTurn[] {
		return [...this.history];
	}
}
