// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import {
	ViewPlugin,
	Decoration,
	WidgetType,
	type DecorationSet,
	type EditorView,
	type ViewUpdate,
} from "@codemirror/view";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { RangeSetBuilder } from "@codemirror/state";
import type { App, TFile } from "obsidian";
import type { NoteStatusCacheService } from "../../services/cache/note-status-cache.service";
import type { NoteStatusInfo } from "../../services/cache/note-status-cache.service";
import type { FrontmatterIndexService } from "../../services/core/frontmatter-index.service";
import {
	createLinkStatusElement,
	createLinkTextCountElement,
	createHeadingSummaryElement,
	aggregateInfos,
	infoEqual,
} from "./LinkStatusWidget";

class LinkStatusWidget extends WidgetType {
	constructor(
		readonly info: NoteStatusInfo,
		readonly onPlay: () => void,
	) {
		super();
	}

	toDOM(): HTMLElement {
		return createLinkStatusElement({
			info: this.info,
			onPlay: this.onPlay,
		});
	}

	eq(other: LinkStatusWidget): boolean {
		return infoEqual(this.info, other.info);
	}
}

class LinkTextCountWidget extends WidgetType {
	constructor(
		readonly info: NoteStatusInfo,
		readonly onPlay: () => void,
	) {
		super();
	}

	toDOM(): HTMLElement {
		return createLinkTextCountElement({
			info: this.info,
			onPlay: this.onPlay,
		});
	}

	eq(other: LinkTextCountWidget): boolean {
		return infoEqual(this.info, other.info);
	}
}

class HeadingSummaryWidget extends WidgetType {
	constructor(
		readonly info: NoteStatusInfo,
		readonly noteNames: string[],
		readonly onReviewNotes: (noteNames: string[], dueOnly: boolean) => void,
	) {
		super();
	}

	toDOM(): HTMLElement {
		return createHeadingSummaryElement({
			info: this.info,
			onClick: () => this.onReviewNotes(this.noteNames, true),
		});
	}

	eq(other: HeadingSummaryWidget): boolean {
		return infoEqual(this.info, other.info) && this.noteNames.length === other.noteNames.length;
	}
}

// Matches [[link]], [[link|alias]], [[link#heading]], [[link#heading|alias]]
const WIKI_LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g;
const HEADING_RE = /^(#{1,6})\s/;

interface ResolvedLink {
	noteName: string;
	info: NoteStatusInfo;
}

export function createLinkStatusViewPlugin(
	app: App,
	noteStatusCache: NoteStatusCacheService,
	frontmatterIndex: FrontmatterIndexService,
	getEnabled: () => boolean,
	onReviewNote: (file: TFile) => void,
	onReviewNotes: (noteNames: string[], dueOnly: boolean) => void,
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

				const builder = new RangeSetBuilder<Decoration>();
				const sourcePath = app.workspace.getActiveFile()?.path ?? "";

				const resolveLink = (linkText: string): ResolvedLink | null => {
					const file = app.metadataCache.getFirstLinkpathDest(linkText, sourcePath);
					if (!file) return null;
					const uids = frontmatterIndex.getValues("flashcard_uid", file.path);
					if (uids.length === 0) return null;
					const info = noteStatusCache.get(uids[0]!);
					if (!info) return null;
					return { noteName: file.basename, info };
				};

				// Two-pass approach: first collect all decorations, then add in order.
				// RangeSetBuilder requires positions in ascending order.
				const decorations: { pos: number; decoration: Decoration }[] = [];

				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);

					// Pass 1: per-link donuts
					WIKI_LINK_RE.lastIndex = 0;
					let match: RegExpExecArray | null;
					while ((match = WIKI_LINK_RE.exec(text)) !== null) {
						const linkText = match[1]!;
						const absoluteStart = from + match.index;

						const file = app.metadataCache.getFirstLinkpathDest(linkText, sourcePath);
						if (!file) continue;

						const uids = frontmatterIndex.getValues("flashcard_uid", file.path);
						if (uids.length === 0) continue;

						const info = noteStatusCache.get(uids[0]!);
						if (!info) continue;

						const targetFile = file;
						decorations.push({
							pos: absoluteStart,
							decoration: Decoration.widget({
								widget: new LinkStatusWidget(info, () => onReviewNote(targetFile)),
								side: -1,
							}),
						});

						decorations.push({
							pos: absoluteStart + match[0]!.length,
							decoration: Decoration.widget({
								widget: new LinkTextCountWidget(info, () => onReviewNote(targetFile)),
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
								level: headingMatch[1]!.length,
								lineEndPos: charPos + line.length,
							});
							lineStartPositions.push(charPos);
						}
						charPos += line.length + 1;
					}

					for (let i = 0; i < headings.length; i++) {
						const heading = headings[i]!;
						// Section spans from heading end to next heading of same/higher level
						let sectionEnd = from + text.length;
						for (let j = i + 1; j < headings.length; j++) {
							if (headings[j]!.level <= heading.level) {
								sectionEnd = lineStartPositions[j]!;
								break;
							}
						}

						const sectionText = view.state.doc.sliceString(heading.lineEndPos, sectionEnd);
						WIKI_LINK_RE.lastIndex = 0;
						const sectionLinks: ResolvedLink[] = [];
						const seen = new Set<string>();

						let linkMatch: RegExpExecArray | null;
						while ((linkMatch = WIKI_LINK_RE.exec(sectionText)) !== null) {
							const resolved = resolveLink(linkMatch[1]!);
							if (!resolved || seen.has(resolved.noteName)) continue;
							seen.add(resolved.noteName);
							sectionLinks.push(resolved);
						}

						if (sectionLinks.length < 2) continue;

						const aggregated = aggregateInfos(sectionLinks.map((l) => l.info));
						const noteNames = sectionLinks.map((l) => l.noteName);

						decorations.push({
							pos: heading.lineEndPos,
							decoration: Decoration.widget({
								widget: new HeadingSummaryWidget(aggregated, noteNames, onReviewNotes),
								side: 1,
							}),
						});
					}
				}

				// Sort by position and add to builder
				decorations.sort((a, b) => a.pos - b.pos);
				for (const { pos, decoration } of decorations) {
					builder.add(pos, pos, decoration);
				}

				this.lastCacheVersion = noteStatusCache.getVersion();
				return builder.finish();
			}
		},
		{
			decorations: (v) => v.decorations,
		},
	);
}
