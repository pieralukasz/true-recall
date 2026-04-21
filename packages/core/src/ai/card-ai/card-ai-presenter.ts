import type { CardFields } from "./card-ai.types";
import type { CardAITarget } from "./card-ai-target";

export interface CardAIPresentArgs {
	target: CardAITarget;
	original: CardFields;
	/** `null` triggers a raw-fallback UI for unparseable responses. */
	proposed: CardFields | null;
	rawResponse?: string;
	autoApply: boolean;
	retry: (extraInstruction: string) => Promise<CardFields>;
}

export interface CardAIPresenter {
	present(args: CardAIPresentArgs): Promise<void>;
}
