export interface NLQueryResult {
	question: string;
	answer: string;
	intermediateSteps: NLQueryStep[];
	error?: string;
}

export interface NLQueryStep {
	action: string;
	input: string;
	output: string;
}

export interface ProblemCard {
	id: string;
	question: string;
	lapses: number;
	stability: number;
	difficulty: number;
	problemType: "high_lapses" | "low_stability" | "relearning";
}

export interface StudyPattern {
	/** 0=Sunday, 6=Saturday */
	bestDays: { day: number; successRate: number }[];
	/** 0-23 */
	bestHours: { hour: number; successRate: number }[];
	heatmap: { day: number; hour: number; count: number; rate: number }[][];
}

export interface TimeToMasteryStats {
	group: string;
	/** Days from first review to mastery (scheduled_days >= 21) */
	avgDays: number;
	cardCount: number;
}

export interface NLQueryConfig {
	apiKey: string;
	model: string;
	proxyUrl?: string;
	topK?: number;
}

export interface ExampleQuery {
	text: string;
	query: string;
}
