import type { Plugin } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SqliteStoreService } from "@true-recall/core/persistence/sqlite";

import { PersistenceLifecycleGuard } from "@true-recall/obsidian/plugin/PersistenceLifecycleGuard";

type Handler = (event?: unknown) => void;

function createFakePlugin() {
	const handlers = new Map<string, Handler[]>();
	const plugin = {
		registerDomEvent: vi.fn(
			(_target: unknown, type: string, handler: Handler) => {
				const list = handlers.get(type) ?? [];
				list.push(handler);
				handlers.set(type, list);
			},
		),
	};
	const fire = (type: string) => {
		for (const handler of handlers.get(type) ?? []) handler();
	};
	return { plugin: plugin as unknown as Plugin, fire };
}

describe("PersistenceLifecycleGuard", () => {
	let saveNow: ReturnType<typeof vi.fn>;
	let store: SqliteStoreService;

	beforeEach(() => {
		saveNow = vi.fn(async () => true);
		store = { saveNow } as unknown as SqliteStoreService;
		(globalThis as { activeDocument?: unknown }).activeDocument = {
			visibilityState: "hidden",
		};
	});

	it("flushes with bestEffort when the document becomes hidden", () => {
		const { plugin, fire } = createFakePlugin();
		new PersistenceLifecycleGuard(() => store).register(plugin);

		fire("visibilitychange");
		expect(saveNow).toHaveBeenCalledWith({ bestEffort: true });
	});

	it("does not flush on visibilitychange to visible", () => {
		(globalThis as { activeDocument?: unknown }).activeDocument = {
			visibilityState: "visible",
		};
		const { plugin, fire } = createFakePlugin();
		new PersistenceLifecycleGuard(() => store).register(plugin);

		fire("visibilitychange");
		expect(saveNow).not.toHaveBeenCalled();
	});

	it("flushes on pagehide", () => {
		const { plugin, fire } = createFakePlugin();
		new PersistenceLifecycleGuard(() => store).register(plugin);

		fire("pagehide");
		expect(saveNow).toHaveBeenCalledTimes(1);
	});

	it("is a no-op when the store is not ready", () => {
		const { plugin, fire } = createFakePlugin();
		new PersistenceLifecycleGuard(() => null).register(plugin);

		expect(() => fire("pagehide")).not.toThrow();
	});
});
