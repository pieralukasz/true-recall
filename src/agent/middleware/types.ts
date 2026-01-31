/**
 * Middleware Types for Tool Pipeline
 *
 * Middleware wraps tool execution to add cross-cutting concerns:
 * - Logging/timing
 * - Undo state capture
 * - Authorization (future)
 * - Retry logic (future)
 */
import type { ToolContext, ToolResult, ToolDefinition } from "../types";

/**
 * Context for middleware execution
 * Contains tool metadata and execution context
 */
export interface ToolExecutionContext {
	/** The tool being executed */
	tool: ToolDefinition;
	/** Tool input arguments */
	args: Record<string, unknown>;
	/** Tool execution context with services */
	toolContext: ToolContext;
	/** Unique execution ID for tracing */
	executionId: string;
	/** Timestamp when execution started */
	startTime: number;
}

/**
 * Next function in middleware chain
 * Call this to continue to the next middleware or actual tool execution
 */
export type NextFunction<T = unknown> = () => Promise<ToolResult<T>>;

/**
 * Middleware function type
 * Wraps tool execution with before/after logic
 *
 * @example
 * const loggingMiddleware: ToolMiddleware = async (ctx, next) => {
 *   console.log(`Executing ${ctx.tool.name}`);
 *   const result = await next();
 *   console.log(`Completed ${ctx.tool.name}`);
 *   return result;
 * };
 */
export type ToolMiddleware = <T = unknown>(
	ctx: ToolExecutionContext,
	next: NextFunction<T>
) => Promise<ToolResult<T>>;

/**
 * Middleware configuration options
 */
export interface MiddlewareOptions {
	/** Whether to skip this middleware for read-only tools */
	skipReadOnly?: boolean;
	/** Tool names to skip */
	skipTools?: string[];
	/** Tool categories to skip */
	skipCategories?: string[];
}
