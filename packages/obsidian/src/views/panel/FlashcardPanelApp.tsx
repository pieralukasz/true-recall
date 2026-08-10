import { Platform } from "obsidian";
import { useMemo } from "preact/hooks";

import { Panel } from "@true-recall/obsidian/components";
import {
	NormalHeader,
	PanelAiStrip,
	PanelContent,
	RModePanel,
	SelectionToolbar,
} from "@true-recall/obsidian/features/library/ui/panel/components";
import {
	PanelScrollProvider,
	usePanelStore,
	useScrollPreservation,
} from "@true-recall/obsidian/features/library/ui/panel/hooks";
import { useStreamingNewCount } from "@true-recall/obsidian/features/library/ui/panel/hooks/useStreamingNewCount";
import { usePlugin } from "@true-recall/obsidian/preact";

export function FlashcardPanelApp({
	onActions,
}: {
	onActions?: (actions: PanelAppActions) => void;
}) {
	const plugin = usePlugin();
	const store = usePanelStore();
	const { contentRef, preserveScroll, captureScroll } = useScrollPreservation();

	const scrollApi = useMemo(
		() => ({ preserveScroll, captureScroll, scrollRef: contentRef }),
		[preserveScroll, captureScroll, contentRef],
	);

	const streamingNewCount = useStreamingNewCount(
		store.cardsWithFsrs,
		store.currentFile?.path,
	);

	const showHeader = !Platform.isMobile;

	return (
		<PanelScrollProvider value={scrollApi}>
			<Panel disableScroll>
				<div class="ep:flex ep:flex-col ep:gap-2 ep:h-full">
					{showHeader && (
						<div class="ep:shrink-0">
							{store.selectionMode === "selecting" ? (
								<SelectionToolbar />
							) : (
								<NormalHeader
									streamingNewCount={streamingNewCount}
									onRefresh={() => onActions?.({ type: "refresh" })}
								/>
							)}
						</div>
					)}

					{plugin.settings.rMode.enabled &&
						store.selectionMode !== "selecting" && (
							<div class="ep:shrink-0">
								<RModePanel />
							</div>
						)}

					<PanelAiStrip />

					<div ref={contentRef} class="ep:flex-1 ep:overflow-y-auto ep:min-h-0">
						<PanelContent />
					</div>
					{store.currentFile && (
						<div
							class="ep:text-ui-smaller ep:text-obs-faint ep:truncate ep:text-center ep:px-2 ep:shrink-0"
							title={store.currentFile.basename}
						>
							{store.currentFile.basename}
						</div>
					)}
				</div>
			</Panel>
		</PanelScrollProvider>
	);
}

export type PanelAppActions = { type: "refresh" };
