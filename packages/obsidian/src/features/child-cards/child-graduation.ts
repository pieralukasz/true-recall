/**
 * Pure decision helpers for child cards, kept free of Obsidian imports so they
 * can be tested directly. Ratings arrive newest first, as returned by
 * `stats.getCardReviewHistory()`; 1=Again 2=Hard 3=Good 4=Easy.
 */

/** The last `streak` ratings are all Good or Easy. */
export function isGraduatable(
	ratings: readonly number[],
	streak: number,
): boolean {
	if (streak <= 0 || ratings.length < streak) return false;
	return ratings.slice(0, streak).every((rating) => rating >= 3);
}

/**
 * How badly the recent reviews went. Hard adds 1 and Again adds `againScore`
 * (0..n), so both keep the failing run going; any Good or Easy ends it.
 *
 * `againScore` is a setting on purpose: with 0 an Again still counts as part
 * of the run but never pushes the score towards the threshold.
 */
export function hardStreakScore(
	ratings: readonly number[],
	againScore = 2,
): number {
	let score = 0;
	for (const rating of ratings) {
		if (rating === 2) score += 1;
		else if (rating === 1) score += againScore;
		else break;
	}
	return score;
}

/** The recent failing run scores at least `streak`. */
export function hasHardStreak(
	ratings: readonly number[],
	streak: number,
	againScore = 2,
): boolean {
	return streak > 0 && hardStreakScore(ratings, againScore) >= streak;
}
