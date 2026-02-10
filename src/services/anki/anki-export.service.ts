import type { App, TFile } from "obsidian";
import type { AnkiExportOptions, FSRSCardData } from "types";
import type { SqliteStoreService } from "../persistence/sqlite/SqliteStoreService";
import type { FSRSService } from "../core/fsrs.service";
import { ApkgBuilderService } from "./apkg-builder.service";

interface DeckInfo {
    id: number;
    name: string;
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

        const cards = this.resolveProjectsAndFilter(allCards, options.projects);

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

    private resolveProjectsAndFilter(
        allCards: FSRSCardData[],
        projectFilter?: string[]
    ): FSRSCardData[] {
        // Resolve projects for each card from frontmatter via sourceUid
        const sourceUidToProjects = this.buildSourceUidToProjectsMap();

        const enriched = allCards.map((card) => {
            if (card.sourceUid) {
                const projects = sourceUidToProjects.get(card.sourceUid);
                if (projects) {
                    return { ...card, projects };
                }
            }
            return card;
        });

        if (!projectFilter || projectFilter.length === 0) {
            return enriched;
        }

        const filterSet = new Set(projectFilter);
        return enriched.filter((card) => {
            if (!card.projects || card.projects.length === 0) return false;
            return card.projects.some((p) => filterSet.has(p));
        });
    }

    private buildSourceUidToProjectsMap(): Map<string, string[]> {
        const map = new Map<string, string[]>();
        const files = this.app.vault.getMarkdownFiles();

        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (!cache?.frontmatter) continue;

            const uid = cache.frontmatter["flashcard_uid"] as string | undefined;
            if (!uid) continue;

            const projects = this.extractProjects(file, cache.frontmatter);
            if (projects.length > 0) {
                map.set(uid, projects);
            }
        }

        return map;
    }

    private extractProjects(
        file: TFile,
        frontmatter: Record<string, unknown>
    ): string[] {
        const projects: string[] = [];

        // Extract from tags: #mind/projectname or #input/projectname
        const tags = frontmatter["tags"];
        if (Array.isArray(tags)) {
            for (const tag of tags) {
                if (typeof tag !== "string") continue;
                const match = tag.match(/^(?:mind|input)\/(.+)$/);
                if (match?.[1]) {
                    projects.push(match[1]);
                }
            }
        }

        // Also check parent folder as implicit project
        const parts = file.path.split("/");
        if (parts.length > 1) {
            const folder = parts[parts.length - 2];
            if (folder && !projects.includes(folder)) {
                // Only use folder if no tags found
                if (projects.length === 0) {
                    projects.push(folder);
                }
            }
        }

        return projects;
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

        // Extract media references from card content
        const mediaRegex = /!\[\[([^\]]+)\]\]/g;
        for (const card of cards) {
            const content = (card.question ?? "") + (card.answer ?? "");
            let match: RegExpExecArray | null;
            while ((match = mediaRegex.exec(content)) !== null) {
                if (match[1]) filenames.add(match[1]);
            }
        }

        // Read each media file from the vault
        for (const filename of filenames) {
            const file = this.app.vault.getFiles().find(
                (f) => f.name === filename || f.path.endsWith("/" + filename)
            );
            if (!file) continue;

            try {
                const data = await this.app.vault.readBinary(file);
                media.set(filename, data);
            } catch {
                console.warn(`[True Recall] Could not read media file: ${filename}`);
            }
        }

        return media;
    }

    private buildDeckMap(cards: FSRSCardData[]): Map<string, DeckInfo> {
        const deckMap = new Map<string, DeckInfo>();

        // Always include Default deck
        deckMap.set("Default", { id: 1, name: "Default" });

        // Create a deck for each unique project
        const projectNames = new Set<string>();
        for (const card of cards) {
            if (card.projects) {
                for (const project of card.projects) {
                    projectNames.add(project);
                }
            }
        }

        for (const name of projectNames) {
            if (name === "Default") continue;
            const id = deckIdFromName(name);
            // Anki uses :: for nested decks, True Recall uses /
            const ankiName = "True Recall::" + name.replace(/\//g, "::");
            deckMap.set(name, { id, name: ankiName });
        }

        return deckMap;
    }

    private getCollectionCreatedAt(cards: FSRSCardData[]): number {
        // Use the earliest card creation time as the collection epoch
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
    // Anki deck IDs are large positive integers
    return Math.abs(hash) + 2000000000;
}
