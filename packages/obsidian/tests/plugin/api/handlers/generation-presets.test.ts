import { describe, expect, it, vi } from "vitest";

import {
	BUILTIN_BASIC_PRESET,
	BUILTIN_BASIC_PRESET_ID,
} from "@true-recall/core/constants";
import type { GenerationPreset } from "@true-recall/core/types/generation-preset.types";

import {
	handleCreateGenerationPreset,
	handleDeleteGenerationPreset,
	handleGenerateWithPreset,
	handleGetGenerationPreset,
	handleListGenerationPresets,
	handleUpdateGenerationPreset,
} from "../../../../src/plugin/api/handlers/generation-presets";

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

type MockedService = {
	generationPresetService: {
		list: () => GenerationPreset[];
		get: (id: string) => GenerationPreset | null;
		create: (input: unknown) => Promise<GenerationPreset>;
		update: (id: string, patch: unknown) => Promise<GenerationPreset>;
		delete: (id: string) => Promise<void>;
	};
	isStoreReady: () => boolean;
	settings: { proKey: string };
};

function mockPlugin(
	presets: GenerationPreset[] = [BUILTIN_BASIC_PRESET],
	opts: { storeReady?: boolean } = {},
): MockedService {
	const store = { presets: [...presets] };
	return {
		generationPresetService: {
			list: () => store.presets,
			get: (id: string) => store.presets.find((p) => p.id === id) ?? null,
			create: vi.fn(async (input: unknown) => {
				const created = {
					...(input as object),
					id: "new-id",
					createdAt: 1,
					updatedAt: 1,
				} as GenerationPreset;
				store.presets.push(created);
				return created;
			}),
			update: vi.fn(async (id: string, patch: unknown) => {
				const idx = store.presets.findIndex((p) => p.id === id);
				if (idx === -1) throw new Error(`Preset '${id}' not found`);
				const existing = store.presets[idx];
				if (!existing) throw new Error(`Preset '${id}' not found`);
				const updated = {
					...existing,
					...(patch as object),
					updatedAt: 2,
				} as GenerationPreset;
				store.presets[idx] = updated;
				return updated;
			}),
			delete: vi.fn(async (id: string) => {
				const idx = store.presets.findIndex((p) => p.id === id);
				if (idx === -1) throw new Error(`Preset '${id}' not found`);
				store.presets.splice(idx, 1);
			}),
		},
		isStoreReady: () => opts.storeReady ?? true,
		settings: { proKey: "test-key" },
	};
}

describe("generation-presets handlers", () => {
	it("GET list returns all presets", () => {
		const res = mockRes();
		handleListGenerationPresets({} as never, res as never, {
			plugin: mockPlugin() as never,
		});
		expect(res.calls[0]?.status).toBe(200);
		const body = res.calls[0]?.body as { ok: true; data: GenerationPreset[] };
		expect(body.data).toHaveLength(1);
	});

	it("GET by id returns the preset", () => {
		const res = mockRes();
		handleGetGenerationPreset(
			{} as never,
			res as never,
			{ plugin: mockPlugin() as never },
			{ id: BUILTIN_BASIC_PRESET_ID },
		);
		expect(res.calls[0]?.status).toBe(200);
	});

	it("GET by unknown id returns 404", () => {
		const res = mockRes();
		handleGetGenerationPreset(
			{} as never,
			res as never,
			{ plugin: mockPlugin() as never },
			{ id: "nope" },
		);
		expect(res.calls[0]?.status).toBe(404);
	});

	it("POST create with valid body returns 200", async () => {
		const res = mockRes();
		await handleCreateGenerationPreset(
			mockReq({
				name: "X",
				prompt: "Make cards.",
				noteTypeId: "builtin-basic",
				requiresPro: false,
				isDefault: false,
			}),
			res as never,
			{ plugin: mockPlugin() as never },
		);
		expect(res.calls[0]?.status).toBe(200);
	});

	it("POST create maps validation failure to 400", async () => {
		const res = mockRes();
		const plugin = mockPlugin();
		plugin.generationPresetService.create = vi.fn(async () => {
			throw new Error("Preset validation failed: name must be non-empty");
		});
		await handleCreateGenerationPreset(mockReq({}), res as never, {
			plugin: plugin as never,
		});
		expect(res.calls[0]?.status).toBe(400);
	});

	it("POST update with valid patch returns 200", async () => {
		const res = mockRes();
		await handleUpdateGenerationPreset(
			mockReq({ name: "New" }),
			res as never,
			{ plugin: mockPlugin() as never },
			{ id: BUILTIN_BASIC_PRESET_ID },
		);
		expect(res.calls[0]?.status).toBe(200);
	});

	it("POST update on unknown id returns 404", async () => {
		const res = mockRes();
		const plugin = mockPlugin();
		plugin.generationPresetService.update = vi.fn(async () => {
			throw new Error("Preset 'nope' not found");
		});
		await handleUpdateGenerationPreset(
			mockReq({ name: "X" }),
			res as never,
			{ plugin: plugin as never },
			{ id: "nope" },
		);
		expect(res.calls[0]?.status).toBe(404);
	});

	it("DELETE on Pro returns 403", async () => {
		const res = mockRes();
		const plugin = mockPlugin();
		plugin.generationPresetService.delete = vi.fn(async () => {
			throw new Error("Cannot delete Pro preset");
		});
		await handleDeleteGenerationPreset(
			{} as never,
			res as never,
			{ plugin: plugin as never },
			{ id: BUILTIN_BASIC_PRESET_ID },
		);
		expect(res.calls[0]?.status).toBe(403);
	});

	it("DELETE on valid id returns 200", async () => {
		const res = mockRes();
		await handleDeleteGenerationPreset(
			{} as never,
			res as never,
			{
				plugin: mockPlugin([
					BUILTIN_BASIC_PRESET,
					{ ...BUILTIN_BASIC_PRESET, id: "p2", isDefault: false },
				]) as never,
			},
			{ id: "p2" },
		);
		expect(res.calls[0]?.status).toBe(200);
	});
});

describe("handleGenerateWithPreset", () => {
	it("returns 503 when store not ready", async () => {
		const res = mockRes();
		await handleGenerateWithPreset(
			mockReq({ text: "hello", preset_id: BUILTIN_BASIC_PRESET_ID }),
			res as never,
			{ plugin: mockPlugin([], { storeReady: false }) as never },
		);
		expect(res.calls[0]?.status).toBe(503);
	});

	it("returns 400 when body missing text or preset_id", async () => {
		const res = mockRes();
		await handleGenerateWithPreset(mockReq({}), res as never, {
			plugin: mockPlugin() as never,
		});
		expect(res.calls[0]?.status).toBe(400);
	});
});
