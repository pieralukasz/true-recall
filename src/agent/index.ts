/**
 * Agent Module
 * Provides Tool/Command architecture for AI function calling and MCP integration
 */

// Core types
export type {
	ToolResult,
	ToolCategory,
	ToolDefinition,
	ToolContext,
	AIFunctionDefinition,
	ToolCallRequest,
} from "./types";

// Registry
export { ToolRegistry, getToolRegistry, resetToolRegistry } from "./registry";

// Context
export { createToolContext } from "./context";

// Service
export { AgentService } from "./service";

// Tools
export { registerAllTools } from "./tools";
export {
	createFlashcardTool,
	createZettelTool,
	searchVaultTool,
	updateCardTool,
} from "./tools";
