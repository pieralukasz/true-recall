import { describe, expect, it } from "vitest";

import {
	TRUERECALL_NEWSLETTER_URL,
	TRUERECALL_PRICING_URL,
	TRUERECALL_WEB_URL,
} from "../../src/constants";
import { withPluginUtm } from "../../src/utils/plugin-link.utils";

describe("withPluginUtm", () => {
	it("tags a plain web URL with the source and the calling surface", () => {
		const tagged = new URL(withPluginUtm(TRUERECALL_PRICING_URL, "pro-notice"));

		expect(tagged.searchParams.get("utm_source")).toBe("plugin");
		expect(tagged.searchParams.get("utm_medium")).toBe("pro-notice");
	});

	it("keeps the path of the tagged URL untouched", () => {
		const tagged = new URL(withPluginUtm(TRUERECALL_PRICING_URL, "whats-new"));

		expect(tagged.origin).toBe(new URL(TRUERECALL_WEB_URL).origin);
		expect(tagged.pathname).toBe("/pricing/");
	});

	it("preserves an existing query string", () => {
		const tagged = new URL(
			withPluginUtm(
				`${TRUERECALL_WEB_URL}/auth/plugin?state=abc`,
				"settings-plan",
			),
		);

		expect(tagged.searchParams.get("state")).toBe("abc");
		expect(tagged.searchParams.get("utm_medium")).toBe("settings-plan");
	});

	it("keeps the fragment after the query so anchors still resolve", () => {
		const tagged = withPluginUtm(
			TRUERECALL_NEWSLETTER_URL,
			"settings-newsletter",
		);

		expect(tagged.endsWith("#newsletter")).toBe(true);
		expect(new URL(tagged).searchParams.get("utm_source")).toBe("plugin");
	});

	it("overwrites tags instead of appending a second copy", () => {
		const once = withPluginUtm(TRUERECALL_PRICING_URL, "pro-notice");
		const twice = withPluginUtm(once, "whats-new");

		expect(twice.match(/utm_source/g)).toHaveLength(1);
		expect(new URL(twice).searchParams.get("utm_medium")).toBe("whats-new");
	});

	it("leaves third-party URLs unchanged", () => {
		const github = "https://github.com/pieralukasz/true-recall";

		expect(withPluginUtm(github, "whats-new")).toBe(github);
	});

	it("leaves a URL it cannot parse unchanged", () => {
		expect(withPluginUtm("not a url", "whats-new")).toBe("not a url");
	});
});
