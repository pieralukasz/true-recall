import type { CardSchedulingMeta } from "@true-recall/core/types";
import { G, MUTATION_GROUPS, type MutationType, Q } from "./queries";
import { getDataLayer } from "./use-data";

export function mutate<R>(type: MutationType, fn: () => R): R {
	const dl = getDataLayer();
	const groups = MUTATION_GROUPS[type];
	return dl.mutate([...groups], fn);
}

export function mutateReviewGrade(
	cardId: string,
	fn: () => void,
	getUpdatedMeta: () => CardSchedulingMeta | null,
): void {
	fn();
	const dl = getDataLayer();
	const updated = getUpdatedMeta();
	if (updated) {
		dl.patch<Map<string, CardSchedulingMeta>>(Q.ALL_META, (map) => {
			const next = new Map(map);
			next.set(cardId, updated);
			return next;
		});
	}
	dl.invalidateGroups([G.DASHBOARD, G.STATS]);
}
