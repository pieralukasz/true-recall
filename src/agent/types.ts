/**
 * Core types for Tool/Command architecture
 * Provides unified API for AI function calling and future MCP integration
 */
import { z } from "zod";
import type { App, TFile } from "obsidian";
import type { FlashcardManager } from "../services/flashcard/flashcard.service";
import type { FSRSService } from "../services/core/fsrs.service";
import type { OpenRouterService } from "../services/ai/openrouter.service";
import type { DayBoundaryService } from "../services/core/day-boundary.service";
import type { CardStore, EpistemeSettings } from "../types";
import type { EventBusService } from "../services/core/event-bus.service";

/**
 * Tool execution result
 */
export interface ToolResult<T = unknown> {
	success: boolean;
	data?: T;
	error?: {
		code: string;
		message: string;
		details?: unknown;
	};
	meta?: {
		executionTimeMs?: number;
		eventsEmitted?: string[];
	};
}

/**
 * Tool categories for grouping and filtering
 */
export type ToolCategory = "flashcard" | "review" | "ai" | "query" | "backup" | "note";

/**
 * Tool definition interface
 * Describes a callable operation with input/output schemas
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
	/** Unique identifier in kebab-case (e.g., "create-flashcard") */
	name: string;

	/** Human-readable description for AI function calling */
	description: string;

	/** Category for grouping tools */
	category: ToolCategory;

	/** Zod schema for input validation */
	inputSchema: z.ZodType<TInput>;

	/** Zod schema for output (documentation and type safety) */
	outputSchema: z.ZodType<TOutput>;

	/** Whether this tool modifies state (for safety checks) */
	mutates: boolean;

	/** Execute the tool */
	execute: (input: TInput, context: ToolContext) => Promise<ToolResult<TOutput>>;
}

/**
 * Context provided to every tool execution
 * Contains all services and utilities needed
 */
export interface ToolContext {
	// Core services
	flashcardManager: FlashcardManager;
	fsrsService: FSRSService;
	openRouterService: OpenRouterService;
	dayBoundaryService: DayBoundaryService;

	// Persistence
	cardStore: CardStore;

	// Obsidian API
	app: App;

	// Settings (read-only snapshot)
	settings: Readonly<EpistemeSettings>;

	// Event bus for emitting events
	eventBus: EventBusService;

	// Utility functions
	getActiveFile: () => TFile | null;
	resolveFile: (path: string) => TFile | null;
}

/**
 * OpenAI-compatible function definition for AI function calling
 */
export interface AIFunctionDefinition {
	name: string;
	description: string;
	parameters: {
		type: "object";
		properties: Record<string, unknown>;
		required: string[];
	};
}

/**
 * Tool call request from AI
 */
export interface ToolCallRequest {
	id?: string;
	name: string;
	arguments: Record<string, unknown>;
}
