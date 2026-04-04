import type { CardSchedulingMeta } from "@true-recall/core/types";
import { State } from "ts-fsrs";
import {
	G,
	type GlobalCounts,
	MUTATION_GROUPS,
	type MutationType,
	type NoteStatusInfo,
	Q,
} from "./queries";
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
	const dl = getDataLayer();
	const now = new Date();

	const oldMeta =
		dl.get<Map<string, CardSchedulingMeta>>(Q.ALL_META)?.get(cardId) ?? null;
	const archived =
		dl.get<ReadonlySet<string>>(Q.ARCHIVED_UIDS) ?? new Set<string>();

	fn();

	const updated = getUpdatedMeta();
	if (!updated) {
		dl.invalidateGroups([G.DASHBOARD, G.STATS]);
		return;
	}

	try {
		dl.patch<Map<string, CardSchedulingMeta>>(Q.ALL_META, (map) => {
			const next = new Map(map);
			next.set(cardId, updated);
			return next;
		});

		patchGlobalCounts(dl, oldMeta, updated, archived, now);
		patchNoteStatus(dl, oldMeta, updated, now);
		patchCardsBySource(dl, oldMeta, updated);
	} catch (e) {
		console.error("[mutateReviewGrade] patch failed, falling back:", e);
		dl.invalidateGroups([G.CARDS]);
	}

	dl.invalidateGroups([G.DASHBOARD, G.STATS]);
}

// ── Incremental patch helpers ──────────────────────────────

type CardBucket = "new" | "learning" | "due" | "suspended" | "inactive";

function classifyCard(
	meta: CardSchedulingMeta | null,
	now: Date,
): CardBucket | null {
	if (!meta) return null;
	const fsrs = meta.fsrs;
	if (fsrs.suspended) return "suspended";
	if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now) return "inactive";
	switch (fsrs.state) {
		case State.New:
			return "new";
		case State.Learning:
		case State.Relearning:
			return "learning";
		case State.Review:
			return new Date(fsrs.due) <= now ? "due" : "inactive";
		default:
			return "inactive";
	}
}

function patchGlobalCounts(
	dl: import("./data-layer").DataLayer,
	oldMeta: CardSchedulingMeta | null,
	newMeta: CardSchedulingMeta,
	archived: ReadonlySet<string>,
	now: Date,
): void {
	const isOldArchived = oldMeta?.sourceUid && archived.has(oldMeta.sourceUid);
	const isNewArchived = newMeta.sourceUid && archived.has(newMeta.sourceUid);

	const oldBucket = isOldArchived ? null : classifyCard(oldMeta, now);
	const newBucket = isNewArchived ? null : classifyCard(newMeta, now);

	dl.patch<GlobalCounts>(Q.GLOBAL_COUNTS, (counts) => {
		const c = { ...counts };
		if (oldMeta && !isOldArchived) c.total--;
		if (!isNewArchived) c.total++;
		if (oldBucket === "suspended") c.suspended--;
		if (newBucket === "suspended") c.suspended++;
		if (oldBucket === "new") c.newCount--;
		if (newBucket === "new") c.newCount++;
		if (oldBucket === "learning") c.learning--;
		if (newBucket === "learning") c.learning++;
		if (oldBucket === "due") c.due--;
		if (newBucket === "due") c.due++;
		return c;
	});
}

function patchNoteStatus(
	dl: import("./data-layer").DataLayer,
	oldMeta: CardSchedulingMeta | null,
	newMeta: CardSchedulingMeta,
	now: Date,
): void {
	const sourceUid = newMeta.sourceUid;
	if (!sourceUid) return;

	const oldBucket = classifyCard(oldMeta, now);
	const newBucket = classifyCard(newMeta, now);

	dl.patch<Map<string, NoteStatusInfo>>(Q.NOTE_STATUS, (map) => {
		const info = map.get(sourceUid);
		if (!info) return undefined; // fallback to full reload

		const next = new Map(map);
		const updated = { ...info };

		if (oldBucket === "new") updated.new = Math.max(0, updated.new - 1);
		if (oldBucket === "learning")
			updated.learning = Math.max(0, updated.learning - 1);
		if (oldBucket === "due")
			updated.dueToday = Math.max(0, updated.dueToday - 1);

		if (newBucket === "new") updated.new++;
		if (newBucket === "learning") updated.learning++;
		if (newBucket === "due") updated.dueToday++;

		next.set(sourceUid, updated);
		return next;
	});
}

function patchCardsBySource(
	dl: import("./data-layer").DataLayer,
	_oldMeta: CardSchedulingMeta | null,
	newMeta: CardSchedulingMeta,
): void {
	const sourceUid = newMeta.sourceUid;
	if (!sourceUid) return;

	dl.patch<Map<string, CardSchedulingMeta[]>>(Q.CARDS_BY_SOURCE, (map) => {
		const bucket = map.get(sourceUid);
		if (!bucket) return undefined; // fallback to full reload

		const next = new Map(map);
		const updatedBucket = bucket.map((c) =>
			c.id === newMeta.id ? newMeta : c,
		);
		next.set(sourceUid, updatedBucket);
		return next;
	});
}
