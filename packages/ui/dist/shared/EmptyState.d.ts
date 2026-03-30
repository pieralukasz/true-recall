export interface EmptyStateProps {
    message: string;
    icon?: string;
    actionLabel?: string;
    onAction?: () => void;
}
export declare function EmptyState({ message, icon, actionLabel, onAction, }: EmptyStateProps): import("preact").JSX.Element;
export declare const EmptyStateMessages: {
    readonly NO_FILE: "Open a note to see flashcard options";
    readonly NOT_MARKDOWN: "Select a markdown file";
    readonly NO_FLASHCARDS: "No flashcards yet for this note.";
    readonly LOADING: "Loading flashcards...";
    readonly ERROR: "An error occurred";
};
