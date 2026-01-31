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
import type { ToolMiddleware, ToolExecutionContext } from "../middleware";
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
	private middlewares: ToolMiddleware[] = [];

	constructor(plugin: TrueRecallPlugin) {
		this.plugin = plugin;
		this.registry = getToolRegistry();
	}

	/**
	 * Add middleware to the execution pipeline
	 * @returns this for chaining
	 */
	use(middleware: ToolMiddleware): this {
		this.middlewares.push(middleware);
		return this;
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
	 * Runs through middleware pipeline for cross-cutting concerns
	 */
	async execute<T = unknown>(
		toolName: string,
		args: Record<string, unknown>
	): Promise<ToolResult<T>> {
		const tool = this.registry.get(toolName);
		if (!tool) {
			return {
				success: false,
				error: {
					code: "TOOL_NOT_FOUND",
					message: `Tool '${toolName}' not found`,
				},
			};
		}

		const context = this.createContext();
		const executionId = crypto.randomUUID();
		const startTime = Date.now();

		// Build middleware execution context
		const execCtx: ToolExecutionContext = {
			tool,
			args,
			toolContext: context,
			executionId,
			startTime,
		};

		// Build the middleware chain
		// The innermost function is the actual tool execution
		const executeCore = async (): Promise<ToolResult<T>> => {
			return this.registry.execute<T>(toolName, args, context);
		};

		// Wrap with middlewares (in reverse order so first middleware runs first)
		let chain = executeCore;
		for (let i = this.middlewares.length - 1; i >= 0; i--) {
			const middleware = this.middlewares[i]!;
			const next = chain;
			chain = () => middleware<T>(execCtx, next);
		}

		// Execute the chain
		return chain();
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
