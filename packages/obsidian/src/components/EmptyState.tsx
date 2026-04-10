import { Clickable } from "./Clickable";

interface EmptyStateProps {
	message: string;
	icon?: string;
	actionLabel?: string;
	onAction?: () => void;
}

export function EmptyState({
	message,
	icon,
	actionLabel,
	onAction,
}: EmptyStateProps) {
	return (
		<div class="ep:flex ep:flex-col ep:items-center ep:justify-center ep:flex-1 ep:text-obs-muted ep:text-center ep:py-4 ep:px-2">
			{icon && <div class="ep:text-3xl ep:mb-2">{icon}</div>}
			<div>{message}</div>
			{actionLabel && onAction && (
				<Clickable
					class="ep:mt-3 mod-cta"
					onClick={onAction}
					stopPropagation={false}
				>
					{actionLabel}
				</Clickable>
			)}
		</div>
	);
}

export const EmptyStateMessages = {
	NO_FILE: "Open a note to see flashcard options",
	NOT_MARKDOWN: "Select a markdown file",
	NO_FLASHCARDS: "No flashcards yet for this note.",
	LOADING: "Loading flashcards...",
	ERROR: "An error occurred",
} as const;
