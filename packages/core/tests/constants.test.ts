import { describe, expect, it } from "vitest";

import {
	TRUERECALL_PRICING_URL,
	TRUERECALL_PRO_GUIDE_URL,
	TRUERECALL_WEB_URL,
} from "../src/constants";

describe("True Recall web URLs", () => {
	it("derives the pricing page from the web URL", () => {
		expect(TRUERECALL_PRICING_URL).toBe(`${TRUERECALL_WEB_URL}/pricing/`);
	});

	it("derives the Pro guide page from the web URL", () => {
		expect(TRUERECALL_PRO_GUIDE_URL).toBe(
			`${TRUERECALL_WEB_URL}/getting-started/what-pro-includes/`,
		);
	});

	it("never points at a domain other than the web URL host", () => {
		const host = new URL(TRUERECALL_WEB_URL).host;
		expect(new URL(TRUERECALL_PRICING_URL).host).toBe(host);
		expect(new URL(TRUERECALL_PRO_GUIDE_URL).host).toBe(host);
	});
});
