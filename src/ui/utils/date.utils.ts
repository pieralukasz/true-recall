/**
 * Date Utilities
 * Common date formatting functions for UI components
 */

/**
 * Format a due date as a relative time string
 * @param due - ISO date string
 * @returns Human-readable relative time (e.g., "Today", "2d ago", "1w")
 */
export function formatDueDate(due: string): string {
	const dueDate = new Date(due);
	const now = new Date();
	const diffMs = dueDate.getTime() - now.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays < 0) {
		return diffDays === -1 ? "Yesterday" : `${Math.abs(diffDays)}d ago`;
	} else if (diffDays === 0) {
		// Check if it's actually due today or in the future
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		if (diffHours < 0) {
			return "Today";
		} else if (diffHours < 24) {
			return `${diffHours}h`;
		}
		return "Today";
	} else if (diffDays === 1) {
		return "Tomorrow";
	} else if (diffDays < 7) {
		return `${diffDays}d`;
	} else if (diffDays < 30) {
		return `${Math.floor(diffDays / 7)}w`;
	} else if (diffDays < 365) {
		return `${Math.floor(diffDays / 30)}mo`;
	} else {
		return `${Math.floor(diffDays / 365)}y`;
	}
}

/**
 * Get semantic due status class
 * @param due - ISO date string
 * @returns Status class name ("due-overdue", "due-today", "due-future")
 */
export function getDueDateStatus(due: string): "overdue" | "today" | "future" {
	const dueDate = new Date(due);
	const now = new Date();
	const diffMs = dueDate.getTime() - now.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays < 0) return "overdue";
	if (diffDays === 0) return "today";
	return "future";
}

/**
 * Get Tailwind classes for due date styling
 * @param due - ISO date string
 * @returns Tailwind class string for the due date
 */
export function getDueDateTailwindClass(due: string): string {
	const status = getDueDateStatus(due);

	switch (status) {
		case "overdue":
			return "ep:text-obs-error";
		case "today":
			return "ep:text-obs-interactive ep:font-medium";
		default:
			return "";
	}
}
