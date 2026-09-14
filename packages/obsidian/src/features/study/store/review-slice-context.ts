import type { AppState } from "@true-recall/obsidian/store/types";

import type { QueueSnapshot } from "./review-queue.engine";
export interface ReviewSliceContext {
	set: (fn: (state: AppState) => Partial<AppState>) => void;
	get: () => AppState;
	commitQueue: (snapshot: QueueSnapshot) => void;
	getSnapshot: () => QueueSnapshot;
	clearPreview: () => void;
}
