/**
 * Agent Service
 * Orchestrates AI interaction with tools via function calling
 */
import type {
	ToolContext,
	ToolResult,
	AIFunctionDefinition,
	ToolCallRequest,
} from "../types";
import { getToolRegistry, ToolRegistry } from "../registry";
import { createToolContext } from "../context";
import type TrueRecallPlugin from "../../main";
import type {
	UndoEntry,
	CreateUndoPayload,
	UpdateUndoPayload,
	DeleteUndoPayload,
	BatchCreateUndoPayload,
} from "../../services/undo";

/**
 * Service for AI agent interaction with tools
 * Handles function calling flow and tool execution
 */
export class AgentService {
	private registry: ToolRegistry;
	private plugin: TrueRecallPlugin;

	constructor(plugin: TrueRecallPlugin) {
		this.plugin = plugin;
		this.registry = getToolRegistry();
	}

	/**
	 * Create a fresh tool context
	 * Context is created per-execution to ensure fresh state
	 */
	private createContext(): ToolContext {
		return createToolContext(this.plugin);
	}

	/**
	 * Get available functions for AI function calling
	 */
	getAvailableFunctions(): AIFunctionDefinition[] {
		return this.registry.toAIFunctions();
	}

	/**
	 * Get tool names
	 */
	getToolNames(): string[] {
		return this.registry.getNames();
	}

	/**
	 * Check if a tool exists
	 */
	hasTool(name: string): boolean {
		return this.registry.has(name);
	}

	/**
	 * Execute a single tool call
	 */
	async executeToolCall<T = unknown>(
		call: ToolCallRequest
	): Promise<ToolResult<T>> {
		const context = this.createContext();
		return this.registry.execute<T>(call.name, call.arguments, context);
	}

	/**
	 * Execute multiple tool calls in parallel
	 */
	async executeToolCalls(
		calls: ToolCallRequest[]
	): Promise<Array<{ id?: string; name: string; result: ToolResult }>> {
		const results = await Promise.all(
			calls.map(async (call) => ({
				id: call.id,
				name: call.name,
				result: await this.executeToolCall(call),
			}))
		);
		return results;
	}

	/**
	 * Execute a tool by name with arguments
	 * Convenience method for direct tool invocation
	 * Automatically captures undo state for mutating operations
	 */
	async execute<T = unknown>(
		toolName: string,
		args: Record<string, unknown>
	): Promise<ToolResult<T>> {
		const tool = this.registry.get(toolName);

		// Capture undo state before mutating operations
		let undoEntry: UndoEntry | null = null;
		if (tool?.mutates && this.plugin.undoService) {
			undoEntry = this.captureUndoState(toolName, args);
		}

		const result = await this.executeToolCall<T>({ name: toolName, arguments: args });

		// Push undo entry on success
		if (result.success && undoEntry && this.plugin.undoService) {
			// Update cardId for create operations (ID not known until after execution)
			if (toolName === "create-flashcard" && result.data) {
				const data = result.data as { id?: string };
				if (data.id) {
					(undoEntry.payload as CreateUndoPayload).cardId = data.id;
				}
			}
			// Update cardIds for batch create operations
			if (toolName === "save-flashcards" && result.data) {
				const data = result.data as { cardIds?: string[] };
				if (data.cardIds) {
					(undoEntry.payload as BatchCreateUndoPayload).cardIds = data.cardIds;
				}
			}
			this.plugin.undoService.push(undoEntry);
		}

		return result;
	}

	/**
	 * Capture undo state before a mutating operation
	 */
	private captureUndoState(
		toolName: string,
		args: Record<string, unknown>
	): UndoEntry | null {
		const id = crypto.randomUUID();
		const timestamp = Date.now();

		switch (toolName) {
			case "create-flashcard":
				return {
					id,
					actionType: "create-flashcard",
					description: "Create flashcard",
					timestamp,
					payload: { type: "create", cardId: "" } as CreateUndoPayload,
				};

			case "update-card": {
				const cardId = args.cardId as string;
				const existing = this.plugin.cardStore?.get(cardId);
				if (!existing) return null;
				return {
					id,
					actionType: "update-card",
					description: "Edit flashcard",
					timestamp,
					payload: {
						type: "update",
						cardId,
						previousQuestion: existing.question ?? "",
						previousAnswer: existing.answer ?? "",
					} as UpdateUndoPayload,
				};
			}

			case "delete-flashcard": {
				const cardId = args.cardId as string;
				const existing = this.plugin.cardStore?.get(cardId);
				if (!existing) return null;
				return {
					id,
					actionType: "delete-flashcard",
					description: "Delete flashcard",
					timestamp,
					payload: {
						type: "delete",
						cardData: { ...existing },
					} as DeleteUndoPayload,
				};
			}

			case "save-flashcards":
				return {
					id,
					actionType: "save-flashcards",
					description: "Create flashcards",
					timestamp,
					payload: { type: "batch-create", cardIds: [] } as BatchCreateUndoPayload,
				};

			default:
				// Other mutating tools don't support undo yet
				return null;
		}
	}

	/**
	 * Get tool descriptions formatted for system prompt
	 */
	getToolDescriptions(): string {
		const tools = this.registry.getAll();
		return tools
			.map(
				(t) =>
					`- ${t.name}: ${t.description} [${t.mutates ? "mutates" : "read-only"}]`
			)
			.join("\n");
	}

	/**
	 * Get tool descriptions as structured data
	 */
	getToolDescriptionsStructured(): Array<{
		name: string;
		description: string;
		category: string;
		mutates: boolean;
	}> {
		return this.registry.getAll().map((t) => ({
			name: t.name,
			description: t.description,
			category: t.category,
			mutates: t.mutates,
		}));
	}
}
