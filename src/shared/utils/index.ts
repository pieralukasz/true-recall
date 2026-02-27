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
	BR_REGEX,
	stripBrTags,
	stripMarkdownSyntax,
	stripWikiLinkSyntax,
} from "@shared/utils/string.utils";
export {
	type SubscriptionTier,
	getEffectiveTier,
	isFeatureAllowed,
} from "@shared/utils/subscription.utils";
