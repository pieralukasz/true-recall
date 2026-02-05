import { State } from "ts-fsrs";
import { ReactiveCache } from "../../../services/cache/ReactiveCache";
import type { EventBusService } from "../../../services/core/event-bus.service";
import type { FrontmatterIndexService } from "../../../services/core/frontmatter-index.service";
import type { SqliteStoreService } from "../../../services/persistence/sqlite";

export interface ProjectStats {
	cardCount: number;
	dueCount: number;
	newCount: number;
}

export interface ProjectDataSnapshot {
	sourceUidToProjects: Map<string, string[]>;
	projectStats: Map<string, ProjectStats>;
}

export class ProjectDataService {
	private sourceUidToProjectsCache: ReactiveCache<Map<string, string[]>>;
	private projectStatsCache: ReactiveCache<Map<string, ProjectStats>>;

	constructor(
		private frontmatterIndex: FrontmatterIndexService,
		private cardStore: SqliteStoreService,
		eventBus: EventBusService
	) {
		this.sourceUidToProjectsCache = new ReactiveCache({
			compute: () => Promise.resolve(this.computeSourceUidToProjects()),
			invalidateOn: ["card:added", "card:removed", "card:updated", "cards:bulk-change"],
			eventBus,
			label: "sourceUidToProjects",
		});

		this.projectStatsCache = new ReactiveCache({
			compute: () => Promise.resolve(this.computeProjectStats()),
			invalidateOn: ["card:added", "card:removed", "card:reviewed", "cards:bulk-change"],
			eventBus,
			label: "projectStats",
		});
	}

	async getSourceUidToProjects(): Promise<Map<string, string[]>> {
		return this.sourceUidToProjectsCache.get();
	}

	async getProjectStats(): Promise<Map<string, ProjectStats>> {
		return this.projectStatsCache.get();
	}

	async getSnapshot(forceRefresh = false): Promise<ProjectDataSnapshot> {
		const [sourceUidToProjects, projectStats] = await Promise.all([
			this.sourceUidToProjectsCache.get(forceRefresh),
			this.projectStatsCache.get(forceRefresh),
		]);

		return { sourceUidToProjects, projectStats };
	}

	async getProjectsForSourceUid(sourceUid: string): Promise<string[]> {
		const map = await this.getSourceUidToProjects();
		return map.get(sourceUid) ?? [];
	}

	invalidateProjectsCache(): void {
		this.sourceUidToProjectsCache.invalidate();
		this.projectStatsCache.invalidate();
	}

	private computeSourceUidToProjects(): Map<string, string[]> {
		const result = new Map<string, string[]>();
		const allCards = this.cardStore.cards.getAll();

		for (const card of allCards) {
			if (!card.sourceUid) continue;

			const file = this.frontmatterIndex.getFileByValue("flashcard_uid", card.sourceUid);
			if (!file) continue;

			const projects = this.frontmatterIndex.getValues("projects", file.path);
			if (projects.length > 0) {
				result.set(card.sourceUid, projects);
			}
		}

		return result;
	}

	private computeProjectStats(): Map<string, ProjectStats> {
		const result = new Map<string, ProjectStats>();
		const allCards = this.cardStore.cards.getAll();
		const sourceUidToProjects = this.computeSourceUidToProjects();
		const now = new Date();

		for (const card of allCards) {
			if (!card.sourceUid) continue;
			if (card.suspended) continue;
			if (card.buriedUntil && new Date(card.buriedUntil) > now) continue;

			const projects = sourceUidToProjects.get(card.sourceUid) ?? [];
			for (const project of projects) {
				const stats = result.get(project) ?? { cardCount: 0, dueCount: 0, newCount: 0 };
				stats.cardCount++;

				if (new Date(card.due) <= now) {
					stats.dueCount++;
				}
				if (card.state === State.New) {
					stats.newCount++;
				}

				result.set(project, stats);
			}
		}

		return result;
	}

	dispose(): void {
		this.sourceUidToProjectsCache.dispose();
		this.projectStatsCache.dispose();
	}
}
