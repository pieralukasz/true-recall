import { describe, expect, it, vi } from "vitest";

import {
	DEFAULT_FSRS_PRESET,
	DEFAULT_FSRS_WEIGHTS,
} from "@true-recall/core/constants";
import type { FSRSPreset } from "@true-recall/core/types";

import type { ApiContext } from "../../../../src/plugin/api/api.types";
import {
	handleOptimizeParameters,
	handleSimulateReviews,
} from "../../../../src/plugin/api/handlers/fsrs-advanced";

const PRESET_WEIGHTS = DEFAULT_FSRS_WEIGHTS.map((w) => w + 0.5);
const LEGACY_WEIGHTS = DEFAULT_FSRS_WEIGHTS.map((w) => w + 9);

function mockRes() {
	const calls: Array<{ status: number; body: unknown }> = [];
	return {
		writeHead: (status: number) => {
			calls.push({ status, body: undefined });
		},
		end: (data?: string) => {
			const last = calls[calls.length - 1];
			if (last) last.body = data ? JSON.parse(data) : undefined;
		},
		calls,
	};
}

function mockReq(url: string, body?: unknown) {
	const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
	const req = {
		url,
		on(event: string, cb: (...a: unknown[]) => void) {
			const existing = listeners[event] ?? [];
			existing.push(cb);
			listeners[event] = existing;
			return req;
		},
		destroy() {},
	};
	setTimeout(() => {
		if (body !== undefined) {
			for (const cb of listeners.data ?? []) {
				cb(Buffer.from(JSON.stringify(body)));
			}
		}
		for (const cb of listeners.end ?? []) cb();
	}, 0);
	return req as never;
}

function mockPlugin(defaultPreset: FSRSPreset) {
	const optimizeParameters = vi.fn(async () => ({ weights: [], metrics: {} }));
	return {
		optimizeParameters,
		plugin: {
			isStoreReady: () => true,
			fsrsHelper: { optimizeParameters },
			presetService: {
				getDefaultPreset: () => defaultPreset,
				getPresetByName: () => undefined,
			},
			settings: {
				fsrsWeights: [...LEGACY_WEIGHTS],
				fsrsRequestRetention: 0.7,
			},
		},
	};
}

function ctx(plugin: unknown): ApiContext {
	return { plugin: plugin as ApiContext["plugin"], apiToken: "test" };
}

const defaultPreset: FSRSPreset = {
	...DEFAULT_FSRS_PRESET,
	weights: [...PRESET_WEIGHTS],
	requestRetention: 0.85,
};

describe("handleSimulateReviews", () => {
	it("defaults weights and retention to the default preset, not the legacy mirror", async () => {
		const res = mockRes();
		const { plugin } = mockPlugin(defaultPreset);
		const withPreset = mockRes();
		const withLegacy = mockRes();

		await handleSimulateReviews(
			mockReq("/", { sequences: ["3333"] }),
			res as never,
			ctx(plugin),
		);
		await handleSimulateReviews(
			mockReq("/", {
				sequences: ["3333"],
				weights: PRESET_WEIGHTS,
				retention: 0.85,
			}),
			withPreset as never,
			ctx(plugin),
		);
		await handleSimulateReviews(
			mockReq("/", {
				sequences: ["3333"],
				weights: LEGACY_WEIGHTS,
				retention: 0.7,
			}),
			withLegacy as never,
			ctx(plugin),
		);

		expect(res.calls[0]?.status).toBe(200);
		expect(res.calls[0]?.body).toEqual(withPreset.calls[0]?.body);
		expect(res.calls[0]?.body).not.toEqual(withLegacy.calls[0]?.body);
	});
});

describe("handleOptimizeParameters", () => {
	it("starts from the default preset when the named preset does not exist", async () => {
		const { plugin, optimizeParameters } = mockPlugin(defaultPreset);

		await handleOptimizeParameters(
			mockReq("/?preset_name=Missing"),
			mockRes() as never,
			ctx(plugin),
		);

		expect(optimizeParameters).toHaveBeenCalledWith(
			{},
			"Missing",
			PRESET_WEIGHTS,
		);
	});

	it("passes null weights through when the default preset uses FSRS defaults", async () => {
		const { plugin, optimizeParameters } = mockPlugin({
			...DEFAULT_FSRS_PRESET,
			weights: null,
		});

		await handleOptimizeParameters(
			mockReq("/"),
			mockRes() as never,
			ctx(plugin),
		);

		expect(optimizeParameters).toHaveBeenCalledWith({}, undefined, null);
	});
});
