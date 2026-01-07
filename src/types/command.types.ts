/**
 * Command Dashboard Types
 * Type definitions for the command dashboard panel
 */

/**
 * Command categories for organizing dashboard commands
 */
export enum CommandCategory {
	PANEL = "panel",
	GENERATION = "generation",
	REVIEW = "review",
	ANALYSIS = "analysis",
	WORKFLOW = "workflow",
}

/**
 * Definition of a single command in the dashboard
 */
export interface CommandDefinition {
	id: string;
	name: string;
	description: string;
	icon: string;
	category: CommandCategory;
	requiresActiveFile: boolean;
	callback: () => void | Promise<void>;
}

/**
 * Configuration for a command category section
 */
export interface CommandCategoryConfig {
	id: CommandCategory;
	name: string;
	description: string;
	icon: string;
	order: number;
}
