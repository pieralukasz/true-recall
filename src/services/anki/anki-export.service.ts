import type { App } from "obsidian";
import type { AnkiExportOptions, FSRSCardData } from "types";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "../core/fsrs.service";
import { ApkgBuilderService } from "./apkg-builder.service";
import { stripWikiLinkSyntax } from "../../utils";

interface DeckInfo {
    id: number;
    name: string;
}

interface SourceNoteInfo {
    name: string;
    projects: string[];
}

export class AnkiExportService {
    constructor(
        private app: App,
        private store: SqliteStoreService,
        private fsrsService: FSRSService
    ) {}

    async exportApkg(
        options: AnkiExportOptions
    ): Promise<{ data: ArrayBuffer; filename: string }> {
        const allCards = this.store.getAll();
        const mode = options.exportMode ?? "all";

        const cards = this.resolveAndFilter(allCards, mode, options);

        if (cards.length === 0) {
            throw new Error("No cards to export");
        }

        const reviewLogs = options.includeScheduling
            ? this.getReviewLogsForCards(cards)
            : [];

        const media = options.includeMedia
            ? await this.collectMedia(cards)
            : new Map<string, ArrayBuffer>();

        const deckMap = this.buildDeckMap(cards);
        const collectionCreatedAt = this.getCollectionCreatedAt(cards);

        const builder = new ApkgBuilderService(this.app);
        const data = await builder.build({
            cards,
            reviewLogs,
            deckMap,
            collectionCreatedAt,
            includeScheduling: options.includeScheduling,
            media,
        });

        const date = new Date().toISOString().slice(0, 10);
        const filename = `true-recall-export-${date}.apkg`;

        return { data, filename };
    }

    private resolveAndFilter(
        allCards: FSRSCardData[],
        mode: "all" | "projects" | "notes",
        options: AnkiExportOptions
    ): FSRSCardData[] {
        const sourceUidMap = this.buildSourceUidMap();

        // Enrich every card with projects, sourceNoteName, and deckKey
        const enriched = allCards.map((card) => {
            const info = card.sourceUid ? sourceUidMap.get(card.sourceUid) : undefined;
            const projects = info?.projects ?? card.projects ?? [];
            const sourceNoteName = info?.name ?? card.sourceNoteName;

            const deckKey = this.computeDeckKey(mode, projects, sourceNoteName);

            return { ...card, projects, sourceNoteName, deckKey };
        });

        // Filter based on mode
        if (mode === "notes" && options.sourceUids?.length) {
            const uidSet = new Set(options.sourceUids);
            return enriched.filter((card) => card.sourceUid && uidSet.has(card.sourceUid));
        }

        if (mode === "projects" && options.projects?.length) {
            const filterSet = new Set(options.projects);
            return enriched.filter((card) => {
                if (!card.projects || card.projects.length === 0) return false;
                return card.projects.some((p) => filterSet.has(p));
            });
        }

        return enriched;
    }

    private computeDeckKey(
        mode: "all" | "projects" | "notes",
        projects: string[],
        sourceNoteName?: string
    ): string {
        if (mode === "notes") {
            return sourceNoteName ?? "Default";
        }

        // For 'all' and 'projects': Project::NoteName hierarchy
        const project = projects[0];
        if (project && sourceNoteName) {
            return `${project}::${sourceNoteName}`;
        }
        if (project) {
            return project;
        }
        return "Default";
    }

    private buildSourceUidMap(): Map<string, SourceNoteInfo> {
        const map = new Map<string, SourceNoteInfo>();
        const files = this.app.vault.getMarkdownFiles();

        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache?.frontmatter) continue;

            const uid = cache.frontmatter["flashcard_uid"] as string | undefined;
            if (!uid) continue;

            const projects = this.extractProjects(cache.frontmatter);
            map.set(uid, { name: file.basename, projects });
        }

        return map;
    }

    private extractProjects(
        frontmatter: Record<string, unknown>
    ): string[] {
        const raw = frontmatter["projects"];
        if (!Array.isArray(raw)) return [];

        return raw
            .filter((p): p is string => typeof p === "string")
            .map((p) => stripWikiLinkSyntax(p))
            .filter((p) => p.length > 0);
    }

    private buildDeckMap(cards: FSRSCardData[]): Map<string, DeckInfo> {
        const deckMap = new Map<string, DeckInfo>();

        deckMap.set("Default", { id: 1, name: "Default" });

        // Collect unique deckKeys
        for (const card of cards) {
            const key = card.deckKey ?? "Default";
            if (key === "Default" || deckMap.has(key)) continue;

            const id = deckIdFromName(key);
            deckMap.set(key, { id, name: key });
        }

        // Ensure parent decks exist (Anki requires them for nested decks)
        for (const key of [...deckMap.keys()]) {
            const parts = key.split("::");
            for (let i = 1; i < parts.length; i++) {
                const parentKey = parts.slice(0, i).join("::");
                if (!deckMap.has(parentKey)) {
                    deckMap.set(parentKey, {
                        id: deckIdFromName(parentKey),
                        name: parentKey,
                    });
                }
            }
        }

        return deckMap;
    }

    private getReviewLogsForCards(cards: FSRSCardData[]) {
        const allLogs = this.store.stats.getModifiedReviewLogSince(0);
        const cardIdSet = new Set(cards.map((c) => c.id));
        return allLogs.filter((log) => cardIdSet.has(log.cardId));
    }

    private async collectMedia(
        cards: FSRSCardData[]
    ): Promise<Map<string, ArrayBuffer>> {
        const media = new Map<string, ArrayBuffer>();
        const filenames = new Set<string>();

        const mediaRegex = /!\[\[([^\]]+)\]\]/g;
        for (const card of cards) {
            const content = (card.question ?? "") + (card.answer ?? "");
            let match: RegExpExecArray | null;
            while ((match = mediaRegex.exec(content)) !== null) {
                if (match[1]) filenames.add(match[1]);
            }
        }

        for (const filename of filenames) {
            const file = this.app.vault.getFiles().find(
                (f) => f.name === filename || f.path.endsWith("/" + filename)
            );
            if (!file) continue;

            try {
                const data = await this.app.vault.readBinary(file);
                media.set(filename, data);
            } catch {
                console.error(`[True Recall] Could not read media file: ${filename}`);
            }
        }

        return media;
    }

    private getCollectionCreatedAt(cards: FSRSCardData[]): number {
        let earliest = Date.now();
        for (const card of cards) {
            if (card.createdAt && card.createdAt < earliest) {
                earliest = card.createdAt;
            }
        }
        return Math.floor(earliest / 1000);
    }
}

function deckIdFromName(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        const char = name.charCodeAt(i);
        hash = ((hash << 5) - hash + char) | 0;
    }
    return Math.abs(hash) + 2000000000;
}
