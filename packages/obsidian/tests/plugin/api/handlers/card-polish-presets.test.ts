import { describe, expect, it, vi } from "vitest";

import type { CardAIPreset } from "@true-recall/core/types/card-ai-preset.types";

import {
	handleCreateCardPolishPreset,
	handleDeleteCardPolishPreset,
	handleListCardPolishPresets,
	handleUpdateCardPolishPreset,
} from "../../../../src/plugin/api/handlers/card-polish-presets";

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

function mockReq(body?: unknown) {
	const listeners: Record<string, ((...a: unknown[]) => void)[]> = {};
	const req = {
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
		for (const cb of listeners.end ?? []) {
			cb();
		}
	}, 0);
	return req as never;
}

function makePreset(overrides: Partial<CardAIPreset> = {}): CardAIPreset {
	return {
		id: "preset-1",
		name: "Fix formatting",
		prompt: "Fix it.",
		autoApply: false,
		builtin: false,
		...overrides,
	};
}

function mockPlugin(presets: CardAIPreset[] = [makePreset()]) {
	const settings = {
		cardPolish: { userPresets: presets, customPromptAutoApply: false },
	};
	const saveSettings = vi.fn(async () => {});
	return {
		plugin: { settings, saveSettings } as never,
		settings,
		saveSettings,
	};
}

describe("card-polish-presets handlers", () => {
	it("GET list returns all presets", () => {
		const res = mockRes();
		const { plugin } = mockPlugin();
		handleListCardPolishPresets({} as never, res as never, { plugin });
		expect(res.calls[0]?.status).toBe(200);
		const body = res.calls[0]?.body as { data: CardAIPreset[] };
		expect(body.data).toHaveLength(1);
	});

	it("GET list returns empty when the bucket is missing", () => {
		const res = mockRes();
		const plugin = { settings: {}, saveSettings: vi.fn() } as never;
		handleListCardPolishPresets({} as never, res as never, { plugin });
		const body = res.calls[0]?.body as { data: CardAIPreset[] };
		expect(body.data).toEqual([]);
	});

	it("POST create persists a preset with generated id", async () => {
		const res = mockRes();
		const { plugin, settings, saveSettings } = mockPlugin([]);
		await handleCreateCardPolishPreset(
			mockReq({ name: "Formula", prompt: "Split formulas.", mode: "spawn" }),
			res as never,
			{ plugin },
		);
		expect(res.calls[0]?.status).toBe(200);
		expect(settings.cardPolish.userPresets).toHaveLength(1);
		const created = settings.cardPolish.userPresets[0];
		expect(created?.id).toMatch(/^preset-/);
		expect(created?.mode).toBe("spawn");
		expect(created?.builtin).toBe(false);
		expect(saveSettings).toHaveBeenCalledOnce();
	});

	it("POST create rejects a missing prompt", async () => {
		const res = mockRes();
		const { plugin, saveSettings } = mockPlugin([]);
		await handleCreateCardPolishPreset(mockReq({ name: "X" }), res as never, {
			plugin,
		});
		expect(res.calls[0]?.status).toBe(400);
		expect(saveSettings).not.toHaveBeenCalled();
	});

	it("POST create rejects unknown keys and bad mode", async () => {
		const res = mockRes();
		const { plugin } = mockPlugin([]);
		await handleCreateCardPolishPreset(
			mockReq({ name: "X", prompt: "Y", mode: "clone", executor: "ai" }),
			res as never,
			{ plugin },
		);
		expect(res.calls[0]?.status).toBe(400);
		const body = res.calls[0]?.body as { error: string };
		expect(body.error).toContain("mode");
		expect(body.error).toContain("executor");
	});

	it("POST update merges the patch", async () => {
		const res = mockRes();
		const { plugin, settings } = mockPlugin();
		await handleUpdateCardPolishPreset(
			mockReq({ autoApply: true }),
			res as never,
			{ plugin },
			{ id: "preset-1" },
		);
		expect(res.calls[0]?.status).toBe(200);
		expect(settings.cardPolish.userPresets[0]?.autoApply).toBe(true);
	});

	it("POST update on unknown id returns 404", async () => {
		const res = mockRes();
		const { plugin } = mockPlugin();
		await handleUpdateCardPolishPreset(
			mockReq({ name: "X" }),
			res as never,
			{ plugin },
			{ id: "nope" },
		);
		expect(res.calls[0]?.status).toBe(404);
	});

	it("POST update on builtin returns 403", async () => {
		const res = mockRes();
		const { plugin } = mockPlugin([makePreset({ builtin: true })]);
		await handleUpdateCardPolishPreset(
			mockReq({ name: "X" }),
			res as never,
			{ plugin },
			{ id: "preset-1" },
		);
		expect(res.calls[0]?.status).toBe(403);
	});

	it("DELETE removes the preset", async () => {
		const res = mockRes();
		const { plugin, settings } = mockPlugin();
		await handleDeleteCardPolishPreset(
			{} as never,
			res as never,
			{ plugin },
			{ id: "preset-1" },
		);
		expect(res.calls[0]?.status).toBe(200);
		expect(settings.cardPolish.userPresets).toHaveLength(0);
	});

	it("DELETE on builtin returns 403", async () => {
		const res = mockRes();
		const { plugin, settings } = mockPlugin([makePreset({ builtin: true })]);
		await handleDeleteCardPolishPreset(
			{} as never,
			res as never,
			{ plugin },
			{ id: "preset-1" },
		);
		expect(res.calls[0]?.status).toBe(403);
		expect(settings.cardPolish.userPresets).toHaveLength(1);
	});
});
