import { aggregateDashboardData } from "@true-recall/core/helpers/note-aggregation";
import { StatsCalculatorService } from "@true-recall/core/metrics/stats/stats-calculator.service";
import type { HierarchyTreeNode } from "@true-recall/core/services/hierarchy.service";
import type { FSRSFlashcardItem } from "@true-recall/core/types";
import type { DashboardNoteEntry } from "@true-recall/obsidian/features/study/ui/dashboard/types";
import { State } from "ts-fsrs";
import type { ApiContext, ApiRequest, ApiResponseWriter } from "../api.types";
import { sendError, sendOk } from "../api.types";

export function handleGetDashboard(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
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
	const archivedUids = ctx.plugin.hierarchyService.getArchivedSourceUids();

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
		buildProjectWithStats(node, ctx, cardsBySourceUid, aggregation.notes, now, {
			includeMembers: false,
		}),
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

interface BuildProjectOptions {
	includeMembers?: boolean;
}

function buildProjectWithStats(
	node: HierarchyTreeNode,
	ctx: ApiContext,
	cardsBySourceUid: Map<string, FSRSFlashcardItem[]>,
	allNotes: DashboardNoteEntry[],
	now: Date,
	options: BuildProjectOptions = {},
): ProjectStat {
	const { includeMembers = false } = options;
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

		if (includeMembers) {
			const memberNote = node.memberPaths
				.map((p) => notesByPath.get(p))
				.find((n) => {
					if (!n) return false;
					const frontmatterIndex = ctx.plugin.frontmatterIndex;
					const uids = frontmatterIndex.getValues(
						"flashcard_uid",
						n.path ?? "",
					);
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
	}

	const children = node.children.map((child) =>
		buildProjectWithStats(child, ctx, cardsBySourceUid, allNotes, now, {
			includeMembers: false,
		}),
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

export function handleGetProjects(
	_req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
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
		archivedSourceUids: ctx.plugin.hierarchyService.getArchivedSourceUids(),
	});

	const projects = hierarchy.map((node) =>
		buildProjectWithStats(node, ctx, cardsBySourceUid, aggregation.notes, now, {
			includeMembers: false,
		}),
	);

	sendOk(res, projects);
}

function findProjectNode(
	nodes: HierarchyTreeNode[],
	targetPath: string,
): HierarchyTreeNode | null {
	for (const node of nodes) {
		if (node.path === targetPath) return node;
		const found = findProjectNode(node.children, targetPath);
		if (found) return found;
	}
	return null;
}

export function handleGetProject(
	req: ApiRequest,
	res: ApiResponseWriter,
	ctx: ApiContext,
): void {
	if (!ctx.plugin.isStoreReady()) {
		sendError(res, 503, "Database not ready");
		return;
	}

	const url = new URL(req.url ?? "/", "http://localhost");
	const projectPath = url.searchParams.get("path");
	if (!projectPath) {
		sendError(res, 400, "Query param 'path' is required");
		return;
	}

	const hierarchy = ctx.plugin.hierarchyService.buildHierarchy();
	const node = findProjectNode(hierarchy, projectPath);
	if (!node) {
		sendError(res, 404, `Project not found: ${projectPath}`);
		return;
	}

	const allCards = ctx.plugin.flashcardManager.getAllFSRSCards();
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
		archivedSourceUids: ctx.plugin.hierarchyService.getArchivedSourceUids(),
	});

	const project = buildProjectWithStats(
		node,
		ctx,
		cardsBySourceUid,
		aggregation.notes,
		now,
		{ includeMembers: true },
	);

	sendOk(res, project);
}
