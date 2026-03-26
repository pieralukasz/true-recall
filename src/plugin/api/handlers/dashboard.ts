import type { IncomingMessage, ServerResponse } from "http";
import type { HierarchyTreeNode } from "@features/core/services/hierarchy.service";
import { StatsCalculatorService } from "@features/metrics/services/stats/stats-calculator.service";
import { aggregateDashboardData } from "@features/study/ui/dashboard/helpers/note-aggregation";
import type { DashboardNoteEntry } from "@features/study/ui/dashboard/types";
import type { FSRSFlashcardItem } from "@shared/types";
import { State } from "ts-fsrs";
import type { ApiContext } from "../api.types";
import { sendError, sendOk } from "../api.types";

export async function handleGetDashboard(
	_req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const statsCalc = new StatsCalculatorService(
		ctx.plugin.fsrsService,
		ctx.plugin.flashcardManager,
		ctx.plugin.sessionPersistence,
		ctx.plugin.settings.dayStartHour,
	);
	statsCalc.setSqliteStore(ctx.plugin.cardStore);

	const todaySummary = statsCalc.getTodaySummary();
	const streakInfo = statsCalc.getStreakInfo();
	const allCards = ctx.plugin.flashcardManager.getAllFSRSCards();
	const archivedUids =
		ctx.plugin.hierarchyService.getArchivedSourceUids();

	const aggregation = aggregateDashboardData({
		allCards,
		streakCurrent: streakInfo.current,
		todaySummary,
		newCardsCap: ctx.plugin.settings.newCardsPerDay,
		reviewsCap: ctx.plugin.settings.reviewsPerDay,
		archivedSourceUids: archivedUids,
	});

	// Build project stats
	const hierarchy = ctx.plugin.hierarchyService.buildHierarchy();
	const cardsBySourceUid = buildCardsBySourceUid(allCards);
	const now = new Date();

	const projects = hierarchy.map((node) =>
		buildProjectWithStats(node, ctx, cardsBySourceUid, aggregation.notes, now),
	);

	sendOk(res, {
		totalCards: aggregation.totalCards,
		totalDue: aggregation.totalDue,
		totalNew: aggregation.totalNew,
		totalLearning: aggregation.totalLearning,
		totalOverdue: aggregation.totalOverdue,
		streak: aggregation.streak,
		estimatedTotalMinutes: aggregation.estimatedTotalMinutes,
		noteCount: aggregation.noteCount,
		todayProgress: aggregation.todayProgress,
		orphanedCards: aggregation.orphanedCards,
		projects,
		notes: aggregation.notes.slice(0, 50),
	});
}

function buildCardsBySourceUid(
	cards: FSRSFlashcardItem[],
): Map<string, FSRSFlashcardItem[]> {
	const map = new Map<string, FSRSFlashcardItem[]>();
	for (const card of cards) {
		const uid = card.sourceUid ?? card.fsrs.sourceUid;
		if (!uid) continue;
		const bucket = map.get(uid);
		if (bucket) bucket.push(card);
		else map.set(uid, [card]);
	}
	return map;
}

interface ProjectStat {
	name: string;
	path: string;
	totalCards: number;
	due: number;
	newCount: number;
	learning: number;
	overdue: number;
	memberCount: number;
	presetName?: string;
	children: ProjectStat[];
	members: Array<{
		name: string;
		path: string | null;
		due: number;
		newCount: number;
		learning: number;
		total: number;
		overdueDays: number;
	}>;
}

function buildProjectWithStats(
	node: HierarchyTreeNode,
	ctx: ApiContext,
	cardsBySourceUid: Map<string, FSRSFlashcardItem[]>,
	allNotes: DashboardNoteEntry[],
	now: Date,
): ProjectStat {
	const memberUids = ctx.plugin.hierarchyService.getSourceUidsForProject(
		node.path,
		false,
	);

	let totalCards = 0;
	let due = 0;
	let newCount = 0;
	let learning = 0;
	let overdue = 0;

	const notesByPath = new Map<string, DashboardNoteEntry>();
	for (const n of allNotes) {
		if (n.path) notesByPath.set(n.path, n);
	}

	const members: ProjectStat["members"] = [];

	for (const uid of memberUids) {
		const cards = cardsBySourceUid.get(uid);
		if (!cards) continue;

		let memberDue = 0;
		let memberNew = 0;
		let memberLearning = 0;
		let memberOverdue = 0;

		for (const c of cards) {
			const fsrs = c.fsrs;
			if (fsrs.suspended) continue;
			if (fsrs.buriedUntil && new Date(fsrs.buriedUntil) > now) continue;

			totalCards++;
			if (fsrs.state === State.New) {
				newCount++;
				memberNew++;
			} else if (
				fsrs.state === State.Learning ||
				fsrs.state === State.Relearning
			) {
				learning++;
				memberLearning++;
			} else if (fsrs.state === State.Review && new Date(fsrs.due) <= now) {
				due++;
				memberDue++;
				const daysOverdue = Math.floor(
					(now.getTime() - new Date(fsrs.due).getTime()) / 86400000,
				);
				if (daysOverdue > 0) {
					overdue++;
					memberOverdue = Math.max(memberOverdue, daysOverdue);
				}
			}
		}

		// Find the note entry for this member
		const memberNote = node.memberPaths
			.map((p) => notesByPath.get(p))
			.find((n) => {
				if (!n) return false;
				const frontmatterIndex = ctx.plugin.frontmatterIndex;
				const uids = frontmatterIndex.getValues("flashcard_uid", n.path ?? "");
				return uids.includes(uid);
			});

		members.push({
			name: memberNote?.name ?? cards[0]?.sourceNoteName ?? uid,
			path: memberNote?.path ?? null,
			due: memberDue,
			newCount: memberNew,
			learning: memberLearning,
			total: cards.filter(
				(c) =>
					!c.fsrs.suspended &&
					!(c.fsrs.buriedUntil && new Date(c.fsrs.buriedUntil) > now),
			).length,
			overdueDays: memberOverdue,
		});
	}

	const children = node.children.map((child) =>
		buildProjectWithStats(child, ctx, cardsBySourceUid, allNotes, now),
	);

	// Roll up child stats
	for (const child of children) {
		totalCards += child.totalCards;
		due += child.due;
		newCount += child.newCount;
		learning += child.learning;
		overdue += child.overdue;
	}

	// Resolve preset name for this project
	const presetValues = ctx.plugin.frontmatterIndex.getValues(
		"fsrs_preset",
		node.path,
	);

	return {
		name: node.name,
		path: node.path,
		totalCards,
		due,
		newCount,
		learning,
		overdue,
		memberCount: memberUids.size,
		presetName: presetValues[0],
		children,
		members,
	};
}

export async function handleGetProjects(
	_req: IncomingMessage,
	res: ServerResponse,
	ctx: ApiContext,
): Promise<void> {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const allCards = ctx.plugin.flashcardManager.getAllFSRSCards();
	const hierarchy = ctx.plugin.hierarchyService.buildHierarchy();
	const cardsBySourceUid = buildCardsBySourceUid(allCards);
	const now = new Date();

	const aggregation = aggregateDashboardData({
		allCards,
		streakCurrent: 0,
		todaySummary: {
			studied: 0,
			minutes: 0,
			newCards: 0,
			reviewCards: 0,
			again: 0,
			correctRate: 0,
		},
		newCardsCap: ctx.plugin.settings.newCardsPerDay,
		reviewsCap: ctx.plugin.settings.reviewsPerDay,
		archivedSourceUids:
			ctx.plugin.hierarchyService.getArchivedSourceUids(),
	});

	const projects = hierarchy.map((node) =>
		buildProjectWithStats(node, ctx, cardsBySourceUid, aggregation.notes, now),
	);

	sendOk(res, projects);
}
