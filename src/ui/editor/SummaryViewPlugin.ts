// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import {
	ViewPlugin,
	Decoration,
	type DecorationSet,
	type EditorView,
	type ViewUpdate,
	EditorView as EV,
} from "@codemirror/view";
// eslint-disable-next-line import/no-extraneous-dependencies -- provided by Obsidian at runtime
import { RangeSetBuilder, StateField } from "@codemirror/state";
import type { App } from "obsidian";
import type { NoteStatusCacheService } from "../../services/cache/note-status-cache.service";
import type { FrontmatterIndexService } from "../../services/core/frontmatter-index.service";
import { scanDocumentSections } from "./summary-helpers";
import { SummaryBannerWidget, SectionSummaryWidget } from "./SummaryWidget";

/**
 * Returns an array of extensions: a ViewPlugin that computes decorations
 * and a StateField that provides them (required for block widgets).
 */
export function createSummaryExtension(
	app: App,
	noteStatusCache: NoteStatusCacheService,
	frontmatterIndex: FrontmatterIndexService,
	getBannerEnabled: () => boolean,
	getSectionEnabled: () => boolean,
	onReviewNotes: (noteNames: string[], dueOnly: boolean) => void,
) {
	// Shared mutable state between the ViewPlugin and the StateField
	let currentDecorations: DecorationSet = Decoration.none;

	const field = StateField.define<DecorationSet>({
		create() {
			return Decoration.none;
		},
		update() {
			return currentDecorations;
		},
		provide: (f) => EV.decorations.from(f),
	});

	const plugin = ViewPlugin.fromClass(
		class {
			private lastCacheVersion = -1;

			constructor(view: EditorView) {
				currentDecorations = this.buildDecorations(view);
			}

			update(update: ViewUpdate): void {
				const cacheVersion = noteStatusCache.getVersion();
				if (
					update.docChanged ||
					update.viewportChanged ||
					cacheVersion !== this.lastCacheVersion
				) {
					currentDecorations = this.buildDecorations(update.view);
				}
			}

			private buildDecorations(view: EditorView): DecorationSet {
				try {
					return this.buildDecorationsInner(view);
				} catch (e) {
					console.error("[True Recall] SummaryViewPlugin error:", e);
					return Decoration.none;
				}
			}

			private buildDecorationsInner(view: EditorView): DecorationSet {
				const bannerEnabled = getBannerEnabled();
				const sectionEnabled = getSectionEnabled();

				if ((!bannerEnabled && !sectionEnabled) || !noteStatusCache.hasData()) {
					this.lastCacheVersion = noteStatusCache.getVersion();
					return Decoration.none;
				}

				const docText = view.state.doc.toString();
				const sourcePath = app.workspace.getActiveFile()?.path ?? "";
				const docLength = view.state.doc.length;

				const resolveLink = (linkText: string) => {
					const file = app.metadataCache.getFirstLinkpathDest(linkText, sourcePath);
					if (!file) return null;
					const uids = frontmatterIndex.getValues("flashcard_uid", file.path);
					if (uids.length === 0) return null;
					return { sourceUid: uids[0]!, noteName: file.basename };
				};

				const getStatus = (uid: string) => noteStatusCache.get(uid);

				const { global, sections } = scanDocumentSections(docText, resolveLink, getStatus);

				const builder = new RangeSetBuilder<Decoration>();

				if (bannerEnabled && global) {
					builder.add(
						0,
						0,
						Decoration.widget({
							widget: new SummaryBannerWidget(global, onReviewNotes),
							block: true,
							side: -1,
						}),
					);
				}

				if (sectionEnabled) {
					for (const section of sections) {
						if (section.pos > docLength) continue;
						builder.add(
							section.pos,
							section.pos,
							Decoration.widget({
								widget: new SectionSummaryWidget(section.stats, onReviewNotes),
								block: true,
								side: 1,
							}),
						);
					}
				}

				this.lastCacheVersion = noteStatusCache.getVersion();
				return builder.finish();
			}
		},
	);

	return [field, plugin];
}
