import type { SessionResult } from "@true-recall/core/types/events.types";

import type { CancellableResult } from "@true-recall/obsidian/modals/shared/BasePromiseModal";

export interface CustomStudyModalResult extends CancellableResult {
	sessionResult?: SessionResult;
	saveAsPreset?: boolean;
	presetName?: string;
}

export interface CustomStudyModalScope {
	sourceNoteFilters?: string[];
	scopeLabel?: string;
}
