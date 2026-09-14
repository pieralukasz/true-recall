import { TRUERECALL_WEB_URL } from "../constants";

/**
 * Where in the plugin an outbound link to the website was clicked.
 *
 * Analytics on truerecall.app cannot tell an in-app link apart from a direct
 * visit: both arrive without a referrer. Tagging every plugin link makes the
 * real funnel visible, in-app surface by in-app surface.
 */
export type PluginLinkSurface =
	| "cloud-sync-banner"
	| "pro-intro-banner"
	| "pro-notice"
	| "settings-about"
	| "settings-ai-provider"
	| "settings-integrations"
	| "settings-newsletter"
	| "settings-plan"
	| "settings-plugins"
	| "whats-new";

const UTM_SOURCE = "plugin";

/**
 * Adds `utm_source=plugin` and `utm_medium=<surface>` to a True Recall website
 * URL, preserving any existing query string and fragment.
 *
 * URLs outside the website origin (GitHub, Discord, Buy Me a Coffee) and URLs
 * that cannot be parsed are returned unchanged, so a link never breaks over an
 * analytics tag.
 */
export function withPluginUtm(url: string, surface: PluginLinkSurface): string {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return url;
	}

	if (parsed.origin !== new URL(TRUERECALL_WEB_URL).origin) return url;

	parsed.searchParams.set("utm_source", UTM_SOURCE);
	parsed.searchParams.set("utm_medium", surface);
	return parsed.toString();
}
