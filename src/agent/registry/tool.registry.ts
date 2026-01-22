/**
 * Tool Registry - Central registration and execution of tools
 * Singleton pattern matching EventBusService
 */
import { zodToJsonSchema } from "zod-to-json-schema";
import type {
	ToolDefinition,
	ToolCategory,
	AIFunctionDefinition,
	ToolContext,
	ToolResult,
} from "../types";

/**
 * Central registry for all tools
 * Handles registration, discovery, validation, and execution
 */
export class ToolRegistry {
	private tools = new Map<string, ToolDefinition>();

	/**
	 * Register a tool
	 */
	register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
		if (this.tools.has(tool.name)) {
			console.warn(`[ToolRegistry] Overwriting existing tool: ${tool.name}`);
		}
		this.tools.set(tool.name, tool as ToolDefinition);
	}

	/**
	 * Unregister a tool
	 */
	unregister(name: string): boolean {
		return this.tools.delete(name);
	}

	/**
	 * Get a tool by name
	 */
	get(name: string): ToolDefinition | undefined {
		return this.tools.get(name);
	}

	/**
	 * Get all registered tools
	 */
	getAll(): ToolDefinition[] {
		return Array.from(this.tools.values());
	}

	/**
	 * Get tools by category
	 */
	getByCategory(category: ToolCategory): ToolDefinition[] {
		return this.getAll().filter((t) => t.category === category);
	}

	/**
	 * Get all tool names
	 */
	getNames(): string[] {
		return Array.from(this.tools.keys());
	}

	/**
	 * Check if a tool exists
	 */
	has(name: string): boolean {
		return this.tools.has(name);
	}

	/**
	 * Get tool count
	 */
	get size(): number {
		return this.tools.size;
	}

	/**
	 * Execute a tool with validation
	 */
	async execute<T>(
		name: string,
		input: unknown,
		context: ToolContext
	): Promise<ToolResult<T>> {
		const tool = this.tools.get(name);
		if (!tool) {
			return {
				success: false,
				error: {
					code: "TOOL_NOT_FOUND",
					message: `Tool "${name}" not found in registry`,
				},
			};
		}

		// Validate input against schema
		const parseResult = tool.inputSchema.safeParse(input);
		if (!parseResult.success) {
			return {
				success: false,
				error: {
					code: "VALIDATION_ERROR",
					message: "Invalid input parameters",
					details: parseResult.error.flatten(),
				},
			};
		}

		// Execute with timing
		const startTime = Date.now();
		try {
			const result = await tool.execute(parseResult.data, context);
			return {
				...result,
				meta: {
					...result.meta,
					executionTimeMs: Date.now() - startTime,
				},
			} as ToolResult<T>;
		} catch (error) {
			return {
				success: false,
				error: {
					code: "EXECUTION_ERROR",
					message: error instanceof Error ? error.message : String(error),
				},
				meta: { executionTimeMs: Date.now() - startTime },
			};
		}
	}

	/**
	 * Generate OpenAI-compatible function definitions for AI
	 */
	toAIFunctions(): AIFunctionDefinition[] {
		return this.getAll().map((tool) => this.toolToAIFunction(tool));
	}

	/**
	 * Convert a single tool to AI function definition
	 */
	toolToAIFunction(tool: ToolDefinition): AIFunctionDefinition {
		// Type assertion needed for zod v4 compatibility with zod-to-json-schema v3
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const jsonSchema = zodToJsonSchema(tool.inputSchema as any, {
			target: "openApi3",
			$refStrategy: "none",
		});

		// Extract properties and required from JSON schema
		const schemaObj = jsonSchema as Record<string, unknown>;
		const properties = (schemaObj.properties as Record<string, unknown>) ?? {};
		const required = (schemaObj.required as string[]) ?? [];

		return {
			name: tool.name,
			description: tool.description,
			parameters: {
				type: "object",
				properties,
				required,
			},
		};
	}

	/**
	 * Clear all registered tools
	 */
	clear(): void {
		this.tools.clear();
	}
}

// Singleton instance
let registryInstance: ToolRegistry | null = null;

/**
 * Get the singleton ToolRegistry instance
 */
export function getToolRegistry(): ToolRegistry {
	if (!registryInstance) {
		registryInstance = new ToolRegistry();
	}
	return registryInstance;
}

/**
 * Reset the ToolRegistry (for plugin unload)
 */
export function resetToolRegistry(): void {
	if (registryInstance) {
		registryInstance.clear();
	}
	registryInstance = null;
}
