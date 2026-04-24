export interface HealCardInput {
	question: string;
	answer: string;
	lapses: number;
	stability: number;
	difficulty: number;
	reps: number;
	ratingsPattern: string;
	sourceText?: string;
	ragContext?: string;
}

export interface HealingSuggestion {
	diagnosis: string;
	rewrittenQuestion?: string;
	rewrittenAnswer?: string;
	mnemonic?: string;
}
