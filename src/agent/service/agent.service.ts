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
	 */
	async execute<T = unknown>(
		toolName: string,
		args: Record<string, unknown>
	): Promise<ToolResult<T>> {
		return this.executeToolCall<T>({ name: toolName, arguments: args });
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
