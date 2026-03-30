import type { ContextItem } from "./context/context.types";
import type { ChatTurn, RagQueryService } from "./rag-query.service";

export class RagChatService {
	private history: ChatTurn[] = [];

	constructor(private queryService: RagQueryService) {}

	async *sendMessage(
		message: string,
		context?: ContextItem[],
	): AsyncGenerator<string> {
		const userTurn: ChatTurn = {
			role: "user",
			content: message,
			timestamp: Date.now(),
		};
		this.history.push(userTurn);

		let fullResponse = "";
		try {
			for await (const chunk of this.queryService.queryStream(
				message,
				this.history,
				context,
			)) {
				fullResponse += chunk;
				yield chunk;
			}

			const sources = this.queryService.getLastSearchResults();
			const toolCalls = this.queryService.getLastToolCalls();
			this.history.push({
				role: "assistant",
				content: fullResponse,
				sources,
				toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
				timestamp: Date.now(),
			});
		} catch (e) {
			// Roll back the orphaned user turn so history stays consistent
			this.history.pop();
			throw e;
		}
	}

	clearHistory(): void {
		this.history = [];
	}

	getHistory(): ChatTurn[] {
		return [...this.history];
	}
}
