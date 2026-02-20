// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime

// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { RangeSetBuilder } from "@codemirror/state";
import {
	Decoration,
	type DecorationSet,
	type EditorView,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from "@codemirror/view";
import type { App, TFile } from "obsidian";
import type {
	NoteStatusCacheService,
	NoteStatusInfo,
} from "../../../core/cache/note-status-cache.service";
import type { FrontmatterIndexService } from "../../../core/services/frontmatter-index.service";
import {
	aggregateInfos,
	createLinkStatusElement,
	createLinkTextCountElement,
	infoEqual,
} from "./LinkStatusWidget";

class LinkStatusWidget extends WidgetType {
	constructor(
		readonly info: NoteStatusInfo,
		readonly onPlay: () => void,
		readonly variant: "link" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" = "link",
	) {
		super();
	}

	toDOM(): HTMLElement {
		return createLinkStatusElement({
			info: this.info,
			onPlay: this.onPlay,
			variant: this.variant,
		});
	}

	eq(other: LinkStatusWidget): boolean {
		return infoEqual(this.info, other.info) && this.variant === other.variant;
	}
}

class LinkTextCountWidget extends WidgetType {
	constructor(
		readonly info: NoteStatusInfo,
		readonly onPlay: () => void,
		readonly variant: "link" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" = "link",
	) {
		super();
	}

	toDOM(): HTMLElement {
		return createLinkTextCountElement({
			info: this.info,
			onPlay: this.onPlay,
			variant: this.variant,
		});
	}

	eq(other: LinkTextCountWidget): boolean {
		return infoEqual(this.info, other.info) && this.variant === other.variant;
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
					return { noteName: file.basename, info };
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
						decorations.push({
							pos: absoluteStart,
							decoration: Decoration.widget({
								widget: new LinkStatusWidget(info, () =>
									onReviewNote(targetFile),
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
						const reviewSection = () => onReviewNotes(noteNames, true);

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
