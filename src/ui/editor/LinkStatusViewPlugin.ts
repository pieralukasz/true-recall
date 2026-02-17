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
import { createLinkStatusElement, infoEqual } from "./LinkStatusWidget";

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

// Matches [[link]], [[link|alias]], [[link#heading]], [[link#heading|alias]]
const WIKI_LINK_RE = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]/g;

export function createLinkStatusViewPlugin(
	app: App,
	noteStatusCache: NoteStatusCacheService,
	frontmatterIndex: FrontmatterIndexService,
	getEnabled: () => boolean,
	onReviewNote: (file: TFile) => void,
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

				for (const { from, to } of view.visibleRanges) {
					const text = view.state.doc.sliceString(from, to);
					WIKI_LINK_RE.lastIndex = 0;
					let match: RegExpExecArray | null;

					while ((match = WIKI_LINK_RE.exec(text)) !== null) {
						const linkText = match[1]!;
						const absoluteStart = from + match.index;

						const file = app.metadataCache.getFirstLinkpathDest(
							linkText,
							sourcePath,
						);
						if (!file) continue;

						const uids = frontmatterIndex.getValues(
							"flashcard_uid",
							file.path,
						);
						if (uids.length === 0) continue;

						const info = noteStatusCache.get(uids[0]!);
						if (!info) continue;

						const targetFile = file;

						builder.add(
							absoluteStart,
							absoluteStart,
							Decoration.widget({
								widget: new LinkStatusWidget(info, () => {
									onReviewNote(targetFile);
								}),
								side: -1,
							}),
						);
					}
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
