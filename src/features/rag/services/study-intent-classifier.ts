export type StudyIntent = "knowledge" | "stats" | "mixed";

const STATS_PATTERNS: RegExp[] = [
	/\bstreak/i,
	/\bretention\b/i,
	/\bprogress\b/i,
	/\bstatistic/i,
	/\bperformanc/i,
	/\bworkload\b/i,
	/\bforecast\b/i,
	/\bstudy pattern/i,
	/\bproblem card/i,
	/\bleech/i,
	/\blapse/i,
	/\bmatur/i,
	/\bdifficult/i,
	/\bstabilit/i,
	/\b(over)?due\b/i,
	/\bsession\b/i,
	/\bhow many (cards|reviews|flashcards)/i,
	/\bhow am i doing/i,
	/\bhow('?s| is) my/i,
	/\bcorrect rate/i,
	/\bsuccess rate/i,
	/\baccurac/i,
	/\bfsrs\b/i,
	/\bspaced repetition/i,
	/\bcollection health/i,
	/\bdaily average/i,
	/\bbest (time|day|hour)/i,
	/\bworst card/i,
	/\bhardest card/i,
	/\beasiest card/i,
	/\bstruggl/i,
	/\boverview\b/i,
	/\bsummary of.*(study|review|learn)/i,
	// Polish — compound phrases to avoid false matches on generic words
	/\bil[eę] (kart|powtó|review|sesj)/i,
	/\bmoje post[eę]p/i,
	/\bjak mi.{0,15}idzie/i,
	/\bjak (sobie )?radz[eę]/i,
	/\bsesj[aeię].{0,10}nauk/i,
	/\bpowtór[kz]/i,
	/\btrudne (kart|fiszk)/i,
	/\bdzisiejsz[aey].{0,10}(sesj|nauk|powtó)/i,
];

const KNOWLEDGE_PATTERNS: RegExp[] = [
	/\b(explain|describe|what is|what are|tell me about|according to)\b/i,
	/\bmy notes (about|on|say)\b/i,
	/\bsummarize my.*(notes|documents|vault)\b/i,
	/\bconcept of\b/i,
	/\bdefinition of\b/i,
	/\bhow does .* work\b/i,
	/\bwhat did i write\b/i,
	/\b(co|o czym) (pisał|napisał|jest w not)/i,
];

export function classifyIntent(question: string): StudyIntent {
	const hasStats = STATS_PATTERNS.some((p) => p.test(question));
	const hasKnowledge = KNOWLEDGE_PATTERNS.some((p) => p.test(question));

	if (hasStats && hasKnowledge) return "mixed";
	if (hasStats) return "stats";
	return "knowledge";
}
