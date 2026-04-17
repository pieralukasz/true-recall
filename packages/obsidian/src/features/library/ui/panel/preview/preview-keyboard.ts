import { type Grade, Rating } from "ts-fsrs";

export type PreviewKeyAction =
	| { type: "close" }
	| { type: "reveal" }
	| { type: "grade"; rating: Grade }
	| { type: "noop" };

interface Args {
	key: string;
	isAnswerRevealed: boolean;
	isGradable: boolean;
}

export function resolvePreviewKeyAction({
	key,
	isAnswerRevealed,
	isGradable,
}: Args): PreviewKeyAction {
	if (key === "Escape") return { type: "close" };

	if (!isAnswerRevealed) {
		if (key === " ") return { type: "reveal" };
		return { type: "noop" };
	}

	if (!isGradable) return { type: "noop" };

	switch (key) {
		case " ":
		case "3":
			return { type: "grade", rating: Rating.Good };
		case "1":
			return { type: "grade", rating: Rating.Again };
		case "2":
			return { type: "grade", rating: Rating.Hard };
		case "4":
			return { type: "grade", rating: Rating.Easy };
		default:
			return { type: "noop" };
	}
}
