import { describe, expect, it, vi } from "vitest";

import { detectRegionsFromImage } from "../../src/ai/vision/image-region-detection";
import { DEFAULT_SETTINGS } from "../../src/constants";
import type { IHttpClient } from "../../src/interfaces/http-client";

describe("image region detection proxy contract", () => {
	it.each([
		"pro",
		"openrouter",
	] as const)("preserves bounding-box instructions for %s", async (providerType) => {
		const post = vi.fn().mockResolvedValue({
			status: 200,
			text: "",
			json: {
				id: "fixture",
				choices: [
					{
						message: {
							role: "assistant",
							content: '[{"box_2d":[100,200,400,500],"label":"Cell"}]',
						},
					},
				],
			},
		});
		const httpClient = { post, stream: vi.fn() } as IHttpClient;
		const regions = await detectRegionsFromImage({
			base64: "fixture",
			mimeType: "image/png",
			httpClient,
			settings: {
				...DEFAULT_SETTINGS,
				providerType,
				proKey: "sk-test",
				openRouterApiKey: "sk-byok",
			},
		});
		const payload = post.mock.calls[0][1];
		expect(payload.messages[0].content).toContain("bounding boxes");
		expect(payload.metadata).toEqual(
			providerType === "pro"
				? { call_context: "image-region-detection" }
				: undefined,
		);
		expect(regions).toHaveLength(1);
		expect(regions[0]).toMatchObject({
			label: "Cell",
			x: 0.2,
			y: 0.1,
			w: 0.3,
			h: 0.3,
		});
	});
});
