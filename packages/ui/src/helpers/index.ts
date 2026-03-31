export {
	FSRS_COLORS,
	type FsrsColorConfig,
	type FsrsColorName,
	type FsrsStateKey,
	fsrsStateToColor,
	fsrsStateToColorName,
	fsrsStateToCssVar,
	type HighlightColor,
	MUTED_STATES,
	RATING_COLORS,
	type RatingColorConfig,
} from "./fsrs-colors";

// Theme color utilities are exported from stats/chart-theme
// to avoid name conflicts. Import directly from "../helpers/theme-colors"
// or from "../stats/chart-theme" as needed.
