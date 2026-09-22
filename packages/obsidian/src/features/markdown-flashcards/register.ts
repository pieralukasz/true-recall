import { parseYaml, type TAbstractFile, TFile } from "obsidian";

import {
	hasInlineTag,
	parseMarkdownCards,
	writeMarkers,
} from "@true-recall/core/flashcard/markdown/parser";
import {
	DEFAULT_MARKDOWN_FLASHCARDS,
	type MarkdownFlashcardsSettings,
	MarkdownFlashcardsSettingsSchema,
} from "@true-recall/core/flashcard/markdown/settings";
import { MarkdownCardSyncService } from "@true-recall/core/flashcard/markdown/sync-service";

import { Q } from "@true-recall/obsidian/data/queries";
import { getDataLayer } from "@true-recall/obsidian/data/use-data";
import type TrueRecallPlugin from "@true-recall/obsidian/main";
import { notify } from "@true-recall/obsidian/services/notification.service";

export function isMarkdownFlashcardNote(text: string, tag: string): boolean {
	const frontmatter = /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)(?:\r?\n|$)/.exec(
		text,
	);
	if (frontmatter) {
		const data: unknown = parseYaml(frontmatter[1] ?? "");
		if (data && typeof data === "object" && "tags" in data) {
			const tags = Array.isArray(data.tags)
				? data.tags
				: typeof data.tags === "string"
					? data.tags.split(/[ ,]+/)
					: [];
			if (
				tags.some(
					(value: unknown) =>
						typeof value === "string" && value.replace(/^#/, "") === tag,
				)
			)
				return true;
		}
	}
	return hasInlineTag(text.slice(frontmatter?.[0].length ?? 0), tag);
}

/** Serializes file writes and reads fresh content in Vault.process, including external-editor changes. */
export function registerMarkdownFlashcards(plugin: TrueRecallPlugin): void {
	const { vault } = plugin.app;
	const service = new MarkdownCardSyncService(plugin.cardStore);
	const sources = plugin.flashcardManager.getSourceNoteService();
	const timers = new Map<TFile, ReturnType<typeof setTimeout>>();
	const lastError = new Map<TFile, string>();
	let queue = Promise.resolve();
	let stopped = false;
	let importing = false;
	const settings = (): MarkdownFlashcardsSettings =>
		MarkdownFlashcardsSettingsSchema.parse(
			plugin.settings.markdownFlashcards ?? DEFAULT_MARKDOWN_FLASHCARDS,
		);
	const active = () =>
		!stopped &&
		MarkdownFlashcardsSettingsSchema.safeParse(
			plugin.settings.markdownFlashcards ?? DEFAULT_MARKDOWN_FLASHCARDS,
		).data?.enabled === true;

	const processFile = async (file: TFile) => {
		if (
			!active() ||
			file.extension !== "md" ||
			vault.getAbstractFileByPath(file.path) !== file
		)
			return;
		const config = settings();
		const original = await vault.read(file);
		if (!isMarkdownFlashcardNote(original, config.tag)) return;
		parseMarkdownCards(original, config);
		const sourceUid = await sources.getOrCreateSourceUid(file.path);
		const ownerPath = sources.findSourceNoteByUid(sourceUid);
		if (
			ownerPath &&
			ownerPath !== file.path &&
			vault.getAbstractFileByPath(ownerPath)
		)
			throw new Error(
				"Duplicate flashcard_uid in copied notes. Remove flashcard_uid and True Recall markers from the copy.",
			);
		if (!active()) return;
		const latest = await vault.read(file);
		const needsIds = parseMarkdownCards(latest, config).some(
			(card) => !card.marker,
		);
		const saved = needsIds
			? await vault.process(file, (content) => {
					if (!active() || !isMarkdownFlashcardNote(content, config.tag))
						return content;
					const cards = parseMarkdownCards(content, config);
					const identified = cards.map((card) => ({
						...card,
						marker: card.marker ?? { v: 1 as const, id: crypto.randomUUID() },
					}));
					service.validateOwnership(identified, sourceUid);
					return writeMarkers(content, cards, (card) => {
						const marker = identified[cards.indexOf(card)]?.marker;
						if (!marker) throw new Error("Missing Markdown card ID");
						return marker;
					});
				})
			: latest;
		if (!active() || !isMarkdownFlashcardNote(saved, config.tag)) return;
		// If an external edit raced the saved marker write, process the newer note on the next event.
		if ((await vault.read(file)) !== saved) {
			enqueue(file);
			return;
		}
		const cards = parseMarkdownCards(saved, config);
		importing = true;
		try {
			const changed = service.sync(cards, sourceUid, config.storeScheduling);
			if (changed.length)
				plugin.coreApp.events.emit("cards:bulk", {
					cardIds: changed,
					action: "markdown-sync",
				});
		} finally {
			importing = false;
		}
		if (config.storeScheduling && active()) {
			const snapshot = writeMarkers(saved, cards, (card) => {
				if (!card.marker) throw new Error("Missing Markdown card ID");
				return service.snapshot(card.marker, card.reversed);
			});
			if (snapshot !== saved)
				await vault.process(file, (content) =>
					content === saved && active() ? snapshot : content,
				);
		}
		lastError.delete(file);
	};
	const enqueue = (file: TFile) => {
		if (stopped || file.extension !== "md") return;
		const timer = timers.get(file);
		if (timer) clearTimeout(timer);
		timers.set(
			file,
			setTimeout(() => {
				timers.delete(file);
				queue = queue
					.then(() => processFile(file))
					.catch((error: unknown) => {
						const message =
							error instanceof Error ? error.message : String(error);
						if (lastError.get(file) !== message)
							notify().error(`Markdown flashcards (${file.path}): ${message}`);
						lastError.set(file, message);
					});
			}, 600),
		);
	};
	const scan = () => {
		if (active()) for (const file of vault.getMarkdownFiles()) enqueue(file);
	};
	const onFileChange = (file: TAbstractFile) => {
		if (file instanceof TFile && active()) enqueue(file);
	};
	plugin.registerEvent(vault.on("create", onFileChange));
	plugin.registerEvent(vault.on("modify", onFileChange));
	plugin.registerEvent(vault.on("rename", onFileChange));
	plugin.register(
		plugin.coreApp.events.on("settings:changed", ({ keys }) => {
			if (!keys || keys.includes("markdownFlashcards")) scan();
		}),
	);
	const exportCards = (ids: string[]) => {
		if (importing || !active() || !settings().storeScheduling) return;
		const paths = new Set<string>();
		for (const id of ids) {
			const card = plugin.cardStore.cards.get(id);
			if (card?.createdVia !== "markdown" || !card.sourceUid) continue;
			const path = sources.findSourceNoteByUid(card.sourceUid);
			if (path) paths.add(path);
		}
		for (const path of paths) {
			const file = vault.getAbstractFileByPath(path);
			if (file instanceof TFile) enqueue(file);
		}
	};
	plugin.register(
		plugin.coreApp.events.on("card:reviewed", ({ cardId }) =>
			exportCards([cardId]),
		),
	);
	plugin.register(
		plugin.coreApp.events.on("card:updated", ({ cardId }) =>
			exportCards([cardId]),
		),
	);
	plugin.register(
		plugin.coreApp.events.on("cards:bulk", ({ cardIds }) =>
			exportCards(cardIds),
		),
	);
	// UI bulk operations invalidate the DataLayer without emitting card domain events.
	let observedAt = Date.now();
	const unsubscribe = getDataLayer()
		.signal(Q.ALL_META)
		?.subscribe(() => {
			const since = observedAt - 1;
			observedAt = Date.now();
			if (!importing && active() && settings().storeScheduling) {
				exportCards(
					plugin.cardStore.cards.getModifiedSince(since).map((card) => card.id),
				);
			}
		});
	if (unsubscribe) plugin.register(unsubscribe);
	plugin.addCommand({
		id: "sync-markdown-flashcards",
		name: "Sync Markdown flashcards",
		callback: scan,
	});
	plugin.app.workspace.onLayoutReady(scan);
	plugin.register(() => {
		stopped = true;
		for (const timer of timers.values()) clearTimeout(timer);
		timers.clear();
		lastError.clear();
	});
}
