/**
 * Anki-compatible fuzz math and deterministic weighted day selection.
 *
 * Ported from Anki's rslib/src/scheduler/states/fuzz.rs and
 * load_balancer.rs so per-review balancing matches Anki behavior.
 */

interface FuzzRange {
	start: number;
	end: number;
	factor: number;
}

const FUZZ_RANGES: FuzzRange[] = [
	{ start: 2.5, end: 7.0, factor: 0.15 },
	{ start: 7.0, end: 20.0, factor: 0.1 },
	{ start: 20.0, end: Number.MAX_VALUE, factor: 0.05 },
];

/**
 * Amount of fuzz applied to the interval in both directions: intervals
 * under 2.5 days get none, longer ones get 1 day plus a factor of the days
 * falling into each range.
 */
export function fuzzDelta(interval: number): number {
	if (interval < 2.5) return 0;
	return FUZZ_RANGES.reduce(
		(delta, range) =>
			delta +
			range.factor * Math.max(0, Math.min(interval, range.end) - range.start),
		1.0,
	);
}

/**
 * Bounds of the fuzz range around an interval, clamped to [minimum, maximum].
 * Mirrors Anki's constrained_fuzz_bounds including the widen-by-one rule.
 */
export function constrainedFuzzBounds(
	interval: number,
	minimum: number,
	maximum: number,
): [number, number] {
	const min = Math.min(minimum, maximum);
	const clamped = Math.max(min, Math.min(interval, maximum));
	const delta = fuzzDelta(clamped);

	let lower = Math.round(clamped - delta);
	let upper = Math.round(clamped + delta);

	lower = Math.max(min, Math.min(lower, maximum));
	upper = Math.max(min, Math.min(upper, maximum));

	if (upper === lower && upper > 2 && upper < maximum) {
		upper = lower + 1;
	}

	return [lower, upper];
}

/** FNV-1a string hash — stable seed source for deterministic balancing */
export function hashString(input: string): number {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

/** Small deterministic PRNG (mulberry32) — same seed, same sequence */
export function mulberry32(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export interface WeightedDay {
	day: number;
	weight: number;
}

/** Pick a day proportionally to its weight using the provided PRNG */
export function selectWeightedDay(
	days: WeightedDay[],
	random: () => number,
): number | null {
	const total = days.reduce((sum, d) => sum + d.weight, 0);
	if (total <= 0 || days.length === 0) return null;

	let remaining = random() * total;
	for (const { day, weight } of days) {
		remaining -= weight;
		if (remaining <= 0) return day;
	}
	return days[days.length - 1]?.day ?? null;
}
