import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import type { App, TFile } from "obsidian";

import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite/SqliteStoreService";
import type { FrontmatterIndexService } from "@true-recall/core/services/notes/frontmatter-index.service";

import type { NoteStatusInfo } from "@true-recall/obsidian/data";
import type { NoteStatusCache } from "@true-recall/obsidian/features/core/cache/note-status-cache.service";

import {
	aggregateInfos,
	createLinkStatusElement,
	createLinkTextCountElement,
	infoEqual,
} from "./LinkStatusWidget";

type VariantType = "link" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

class LinkStatusWidget extends WidgetType {
	constructor(
		readonly info: NoteStatusInfo,
		readonly onPlay: () => void,
		readonly variant: VariantType = "link",
		readonly sourceUid?: string,
		readonly getTooltipStats?: () => Promise<unknown>,
	) {
		super();
	}

	toDOM(): HTMLElement {
		return createLinkStatusElement({
			info: this.info,
			onPlay: this.onPlay,
			variant: this.variant,
			sourceUid: this.sourceUid,
			getTooltipStats: this.getTooltipStats,
		});
	}

	eq(other: LinkStatusWidget): boolean {
		return (
			infoEqual(this.info, other.info) &&
			this.variant === other.variant &&
			this.sourceUid === other.sourceUid
		);
	}
}

class LinkTextCountWidget extends WidgetType {
	constructor(
		readonly info: NoteStatusInfo,
		readonly onPlay: () => void,
		readonly variant: VariantType = "link",
		readonly sourceUid?: string,
		readonly getTooltipStats?: () => Promise<unknown>,
	) {
		super();
	}

	toDOM(): HTMLElement {
		return createLinkTextCountElement({
			info: this.info,
			onPlay: this.onPlay,
			variant: this.variant,
			sourceUid: this.sourceUid,
			getTooltipStats: this.getTooltipStats,
		});
	}

	eq(other: LinkTextCountWidget): boolean {
		return (
			infoEqual(this.info, other.info) &&
			this.variant === other.variant &&
			this.sourceUid === other.sourceUid
		);
	}
}

// Matches [[link]], [[link|alias]], [[link#heading]], [[link#heading|alias]]
const WIKI_LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g;
const HEADING_RE = /^(#{1,6})\s/;

interface ResolvedLink {
	noteName: string;
	info: NoteStatusInfo;
	sourceUid: string;
}

function createTooltipStatsFetcher(
	store: SqliteStoreService,
	sourceUid: string,
): () => Promise<{
	retentionRate: number | null;
	avgDifficulty: number;
	avgLapses: number;
	lastReviewed: string | null;
	reviewCount: number;
	futureDue: number[];
} | null> {
	// async needed: callers (attachTooltipListeners) await the result
	return async () => {
		const cards = store.getCardsBySourceUid(sourceUid);
		if (cards.length === 0) return null;

		let totalDifficulty = 0;
		let totalLapses = 0;
		let reviewCount = 0;
		let lastReviewed: string | null = null;
		let correctReviews = 0;
		let totalReviews = 0;

		for (const card of cards) {
			totalDifficulty += card.difficulty;
			totalLapses += card.lapses;
			if (card.lastReview) {
				reviewCount++;
				if (!lastReviewed || card.lastReview > lastReviewed) {
					lastReviewed = card.lastReview;
				}
			}
			totalReviews += card.reps;
			correctReviews += Math.max(0, card.reps - card.lapses);
		}

		// 7-day forecast
		const futureDue: number[] = [];
		for (let i = 0; i < 7; i++) {
			const date = new Date();
			date.setDate(date.getDate() + i);
			const dateStr = date.toISOString().split("T")[0] ?? "";
			let count = 0;
			for (const card of cards) {
				if (card.suspended) continue;
				const cardDate = new Date(card.due).toISOString().split("T")[0];
				if (cardDate === dateStr) count++;
			}
			futureDue.push(count);
		}

		return {
			retentionRate: totalReviews > 0 ? correctReviews / totalReviews : null,
			avgDifficulty: cards.length > 0 ? totalDifficulty / cards.length : 0,
			avgLapses: cards.length > 0 ? totalLapses / cards.length : 0,
			lastReviewed,
			reviewCount,
			futureDue,
		};
	};
}

export function createLinkStatusViewPlugin(
	app: App,
	noteStatusCache: NoteStatusCache,
	frontmatterIndex: FrontmatterIndexService,
	getEnabled: () => boolean,
	getEnabledInReview: () => boolean,
	onReviewNote: (file: TFile) => void,
	onReviewNotes: (noteNames: string[], dueOnly: boolean) => void,
	cardStore?: SqliteStoreService,
) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;
			private lastCacheVersion = -1;

			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}

			update(update: ViewUpdate): void {
				const currentVersion = noteStatusCache.getVersion();
				if (
					update.docChanged ||
					update.viewportChanged ||
					currentVersion !== this.lastCacheVersion
				) {
					this.decorations = this.buildDecorations(update.view);
				}
			}

			private buildDecorations(view: EditorView): DecorationSet {
				if (!getEnabled() || !noteStatusCache.hasData()) {
					this.lastCacheVersion = noteStatusCache.getVersion();
					return Decoration.none;
				}

				if (
					!getEnabledInReview() &&
					view.dom.closest('[data-type="true-recall-review"]')
				) {
					this.lastCacheVersion = noteStatusCache.getVersion();
					return Decoration.none;
				}

				const sourcePath = app.workspace.getActiveFile()?.path ?? "";

				const resolveLink = (linkText: string): ResolvedLink | null => {
					const file = app.metadataCache.getFirstLinkpathDest(
						linkText,
						sourcePath,
					);
					if (!file) return null;
					const uids = frontmatterIndex.getValues("flashcard_uid", file.path);
					if (uids.length === 0) return null;
					const uid = uids[0];
					if (!uid) return null;
					const info = noteStatusCache.get(uid);
					if (!info) return null;
					return { noteName: file.basename, info, sourceUid: uid };
				};

				// Two-pass approach: first collect all decorations, then add in order.
				// RangeSetBuilder requires positions in ascending order.
				const decorations: { pos: number; decoration: Decoration }[] = [];

				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);

					// Pass 1: per-link donuts
					WIKI_LINK_RE.lastIndex = 0;
					for (
						let match = WIKI_LINK_RE.exec(text);
						match !== null;
						match = WIKI_LINK_RE.exec(text)
					) {
						const linkText = match[1];
						if (!linkText) continue;
						const absoluteStart = from + match.index;

						const file = app.metadataCache.getFirstLinkpathDest(
							linkText,
							sourcePath,
						);
						if (!file) continue;

						const uids = frontmatterIndex.getValues("flashcard_uid", file.path);
						if (uids.length === 0) continue;

						const uid = uids[0];
						if (!uid) continue;
						const info = noteStatusCache.get(uid);
						if (!info) continue;

						const targetFile = file;
						const tooltipFetcher = cardStore
							? createTooltipStatsFetcher(cardStore, uid)
							: undefined;
						decorations.push({
							pos: absoluteStart,
							decoration: Decoration.widget({
								widget: new LinkStatusWidget(
									info,
									() => onReviewNote(targetFile),
									"link",
									uid,
									tooltipFetcher,
								),
								side: -1,
							}),
						});

						decorations.push({
							pos: absoluteStart + (match[0]?.length ?? 0),
							decoration: Decoration.widget({
								widget: new LinkTextCountWidget(
									info,
									() => onReviewNote(targetFile),
									"link",
									uid,
									tooltipFetcher,
								),
								side: 1,
							}),
						});
					}

					// Pass 2: heading summaries
					const lines = text.split("\n");
					let charPos = from;

					interface HeadingEntry {
						level: number;
						lineEndPos: number;
					}

					const headings: HeadingEntry[] = [];
					const lineStartPositions: number[] = [];

					for (const line of lines) {
						const headingMatch = HEADING_RE.exec(line);
						if (headingMatch) {
							headings.push({
								level: headingMatch[1]?.length ?? 0,
								lineEndPos: charPos + line.length,
							});
							lineStartPositions.push(charPos);
						}
						charPos += line.length + 1;
					}

					const doc = view.state.doc;

					for (let i = 0; i < headings.length; i++) {
						const heading = headings[i];
						if (!heading) continue;
						// Find section end from the full document so folded content is included
						const nextLineNum = doc.lineAt(heading.lineEndPos).number + 1;
						let sectionEnd = doc.length;
						for (let ln = nextLineNum; ln <= doc.lines; ln++) {
							const m = HEADING_RE.exec(doc.line(ln).text);
							if (m && (m[1]?.length ?? 0) <= heading.level) {
								sectionEnd = doc.line(ln).from;
								break;
							}
						}

						const sectionText = view.state.doc.sliceString(
							heading.lineEndPos,
							sectionEnd,
						);
						WIKI_LINK_RE.lastIndex = 0;
						const sectionLinks: ResolvedLink[] = [];
						const seen = new Set<string>();

						for (
							let linkMatch = WIKI_LINK_RE.exec(sectionText);
							linkMatch !== null;
							linkMatch = WIKI_LINK_RE.exec(sectionText)
						) {
							const linkText = linkMatch[1];
							if (!linkText) continue;
							const resolved = resolveLink(linkText);
							if (!resolved || seen.has(resolved.noteName)) continue;
							seen.add(resolved.noteName);
							sectionLinks.push(resolved);
						}

						if (sectionLinks.length < 2) continue;

						const aggregated = aggregateInfos(sectionLinks.map((l) => l.info));
						const noteNames = sectionLinks.map((l) => l.noteName);
						const reviewSection = () => onReviewNotes(noteNames, false);

						const lineStartPos = lineStartPositions[i];
						if (lineStartPos === undefined) continue;

						decorations.push({
							pos: lineStartPos,
							decoration: Decoration.widget({
								widget: new LinkStatusWidget(
									aggregated,
									reviewSection,
									`h${heading.level}` as
										| "h1"
										| "h2"
										| "h3"
										| "h4"
										| "h5"
										| "h6",
								),
								side: -1,
							}),
						});

						decorations.push({
							pos: heading.lineEndPos,
							decoration: Decoration.widget({
								widget: new LinkTextCountWidget(
									aggregated,
									reviewSection,
									`h${heading.level}` as
										| "h1"
										| "h2"
										| "h3"
										| "h4"
										| "h5"
										| "h6",
								),
								side: 1,
							}),
						});
					}
				}

				this.lastCacheVersion = noteStatusCache.getVersion();
				return Decoration.set(
					decorations.map(({ pos, decoration }) => decoration.range(pos)),
					true,
				);
			}
		},
		{
			decorations: (v) => v.decorations,
		},
	);
}
