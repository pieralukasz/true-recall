/**
 * Central export for utilities
 */

export {
	formatLocalDate,
	getTodayBoundary,
	getTodayKey,
	getTomorrowBoundary,
	isTimestampToday,
} from "@shared/utils/date.utils";
export { getErrorMessage } from "@shared/utils/error.utils";
export {
	type CleanupFn,
	createEventRegistry,
	debounce,
	EventRegistry,
	throttle,
} from "@shared/utils/event.utils";
export {
	buildProjectGraph,
	getDescendantProjects,
	isProjectNote,
	type ProjectGraph,
} from "@shared/utils/project-hierarchy";
export {
	BR_REGEX,
	stripBrTags,
	stripWikiLinkSyntax,
} from "@shared/utils/string.utils";
