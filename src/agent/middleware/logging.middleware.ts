/**
 * Logging Middleware
 *
 * Logs tool execution with timing information.
 * Useful for debugging and performance monitoring.
 */
import type { ToolMiddleware, MiddlewareOptions } from "./types";

/**
 * Create a logging middleware with optional configuration
 */
export function createLoggingMiddleware(options: MiddlewareOptions = {}): ToolMiddleware {
	const { skipReadOnly = false, skipTools = [], skipCategories = [] } = options;

	return async (ctx, next) => {
		const { tool, executionId, startTime } = ctx;

		// Check if we should skip this tool
		if (skipReadOnly && !tool.mutates) {
			return next();
		}
		if (skipTools.includes(tool.name)) {
			return next();
		}
		if (skipCategories.includes(tool.category)) {
			return next();
		}

		// Log start
		console.debug(
			`[Tool:${executionId.slice(0, 8)}] Starting ${tool.name}`,
			tool.mutates ? "(mutates)" : "(read-only)"
		);

		// Execute
		const result = await next();

		// Log completion with timing
		const duration = Date.now() - startTime;
		if (result.success) {
			console.debug(
				`[Tool:${executionId.slice(0, 8)}] Completed ${tool.name} in ${duration}ms`
			);
		} else {
			console.warn(
				`[Tool:${executionId.slice(0, 8)}] Failed ${tool.name} in ${duration}ms:`,
				result.error?.message
			);
		}

		// Add timing to result meta
		return {
			...result,
			meta: {
				...result.meta,
				executionTimeMs: duration,
			},
		};
	};
}
