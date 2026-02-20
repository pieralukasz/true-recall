import type { SessionResult } from "@shared/types/events.types";
import type { CancellableResult } from "@shared/ui/modals/BasePromiseModal";

export interface CustomStudyModalResult extends CancellableResult {
	sessionResult?: SessionResult;
	saveAsPreset?: boolean;
	presetName?: string;
}

export interface CustomStudyModalScope {
	projectFilters?: string[];
	sourceNoteFilters?: string[];
	scopeLabel?: string;
}
