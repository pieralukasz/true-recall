import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	core: vi.fn(),
	store: vi.fn(),
	sync: vi.fn(),
	stop: vi.fn(),
	features: vi.fn(),
	api: vi.fn(),
	notify: vi.fn(),
	canRunApi: vi.fn(() => true),
}));
vi.mock("../../src/plugin/runtime/StorageLifecycle", () => ({
	initializeCoreStorage: mocks.core,
}));
vi.mock("../../src/plugin/PluginInitializers", () => ({
	initializeDeviceAndStore: mocks.store,
	checkForWhatsNew: vi.fn(),
}));
vi.mock("../../src/plugin/runtime/SyncLifecycle", () => ({
	SyncLifecycle: class {
		initialize = mocks.sync;
		stop = mocks.stop;
	},
}));
vi.mock("../../src/plugin/runtime/FeatureRegistry", () => ({
	registerFeatures: mocks.features,
}));
vi.mock("../../src/plugin/api/start-local-api", () => ({
	startLocalApi: mocks.api,
}));
vi.mock("../../src/services/notification.service", () => ({
	notify: () => ({ error: mocks.notify }),
	NOTIFICATION_DURATION: { PERSIST: 0 },
}));
vi.mock("../../src/utils/platform", () => ({
	capabilities: { canRunLocalApi: mocks.canRunApi },
}));

import { PluginRuntime } from "../../src/plugin/runtime/PluginRuntime";

function createRuntime(enableLocalApi = false) {
	const plugin = {
		app: { workspace: { onLayoutReady: vi.fn() } },
		settings: { enableLocalApi, apiPort: 8765 },
		localApi: null,
	};
	return { plugin, runtime: new PluginRuntime(plugin as never, () => false) };
}
describe("PluginRuntime startup", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.core.mockResolvedValue(undefined);
		mocks.store.mockResolvedValue(undefined);
		mocks.sync.mockResolvedValue(undefined);
		mocks.features.mockResolvedValue(undefined);
		mocks.api.mockResolvedValue(null);
		mocks.canRunApi.mockReturnValue(true);
	});
	it("initializes storage before sync and registers features last", async () => {
		const { runtime } = createRuntime();
		await runtime.load();
		expect(mocks.core.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.store.mock.invocationCallOrder[0] ?? 0,
		);
		expect(mocks.store.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.sync.mock.invocationCallOrder[0] ?? 0,
		);
		expect(mocks.sync.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.features.mock.invocationCallOrder[0] ?? 0,
		);
		expect(mocks.api).not.toHaveBeenCalled();
	});
	it.each([
		"core",
		"store",
	] as const)("stops startup when %s initialization fails", async (stage) => {
		mocks[stage].mockRejectedValueOnce(new Error("Storage failed"));
		await createRuntime().runtime.load();
		expect(mocks.sync).not.toHaveBeenCalled();
		expect(mocks.features).not.toHaveBeenCalled();
		expect(mocks.notify).toHaveBeenCalledOnce();
	});
	it("honors the platform guard before starting the local HTTP API", async () => {
		mocks.canRunApi.mockReturnValue(false);
		await createRuntime(true).runtime.load();
		expect(mocks.api).not.toHaveBeenCalled();
	});
	it("stops the shared-vault transport when requested", () => {
		createRuntime().runtime.stopSharedVaultSync();
		expect(mocks.stop).toHaveBeenCalledOnce();
	});
});
