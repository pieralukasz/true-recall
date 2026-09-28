import { parseYaml, type TAbstractFile, TFile } from "obsidian";

import { writeContent } from "@true-recall/core/flashcard/markdown/content-sync";
import {
	findInlineSeparatorLines,
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

import { createMarkerHidingExtension } from "./marker-hiding";

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
export function registerMarkdownFlashcards(plugin: TrueRecallPlugin): {
	whenIdle: () => Promise<void>;
} {
	const { vault } = plugin.app;
	const service = new MarkdownCardSyncService(plugin.cardStore);
	const deviceId = plugin.cardStore.getDeviceId();
	const sources = plugin.flashcardManager.getSourceNoteService();
	const timers = new Map<TFile, ReturnType<typeof setTimeout>>();
	const lastError = new Map<TFile, string>();
	const lastWarning = new Map<TFile, string>();
	/** "Q ?? A" on one line is not a card; say so once per distinct set of lines. */
	const warnInlineSeparators = (
		file: TFile,
		text: string,
		config: MarkdownFlashcardsSettings,
	) => {
		const lines = findInlineSeparatorLines(text, config);
		if (!lines.length) {
			lastWarning.delete(file);
			return;
		}
		const message = `Markdown flashcards (${file.path}): line ${lines.join(", ")} uses ${config.basicSeparator} or ${config.reversedSeparator} inside a sentence, so no card was created. Put the separator on its own line between the question and the answer.`;
		if (lastWarning.get(file) !== message) notify().warning(message);
		lastWarning.set(file, message);
	};
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
		warnInlineSeparators(file, original, config);
		const parsed = parseMarkdownCards(original, config);
		// A tagged note without cards gets no flashcard_uid until it has one,
		// unless it already has an ID (its last card was just removed).
		if (!parsed.length && !(await sources.getSourceUid(file.path))) return;
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

		if (!isMarkdownFlashcardNote(latest, config.tag)) return;
		const originalCards = parseMarkdownCards(latest, config);
		service.validateOwnership(
			originalCards.filter((card) => card.marker),
			sourceUid,
		);
		const { plans, revision } = await service.planContent(
			originalCards,
			sourceUid,
			deviceId,
		);
		const prepared = writeContent(latest, plans, config);
		const unchanged = () =>
			active() && service.contentRevision(sourceUid) === revision;
		if (!unchanged()) {
			enqueue(file);
			return;
		}
		let accepted = true;
		const saved =
			prepared === latest
				? latest
				: await vault.process(file, (content) => {
						if (content !== latest || !unchanged()) {
							accepted = false;
							return content;
						}
						return prepared;
					});
		if (!accepted || (await vault.read(file)) !== saved || !unchanged()) {
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

		// Advance the merge baseline only after BOTH the file and SQLite contain the merged fields.
		if (active()) {
			const baselines = new Map(
				cards.map((card, index) => [card.marker?.id, plans[index]?.base]),
			);
			const snapshot = writeMarkers(saved, cards, (card) => {
				if (!card.marker) throw new Error("Missing Markdown card ID");
				const base = baselines.get(card.marker.id);
				if (!base) throw new Error("Missing content baseline");
				const marker = {
					...card.marker,
					bases: { ...card.marker.bases, [deviceId]: base },
				};
				return config.storeScheduling
					? service.snapshot(marker, card.reversed)
					: marker;
			});
			if (snapshot !== saved) {
				const written = await vault.process(file, (content) =>
					content === saved && active() ? snapshot : content,
				);
				if (written !== snapshot) enqueue(file);
			}
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
		if (importing || !active()) return;
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
		plugin.coreApp.events.on("card:reviewed", ({ cardId }) => {
			if (settings().storeScheduling) exportCards([cardId]);
		}),
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
			if (!importing && active()) {
				exportCards(
					plugin.cardStore.cards.getModifiedSince(since).map((card) => card.id),
				);
				for (const note of plugin.cardStore.notes.getRawRowsModifiedSince(
					since,
				)) {
					if (note.created_via !== "markdown" || !note.source_uid) continue;
					const path = sources.findSourceNoteByUid(note.source_uid);
					const file = path ? vault.getAbstractFileByPath(path) : null;
					if (file instanceof TFile) enqueue(file);
				}
			}
		});
	if (unsubscribe) plugin.register(unsubscribe);
	plugin.registerEditorExtension(createMarkerHidingExtension());
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
		lastWarning.clear();
	});
	return { whenIdle: () => queue };
}
