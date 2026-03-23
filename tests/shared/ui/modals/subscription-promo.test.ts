import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type TrueRecallPlugin from "../../../../src/main";
import type { TrueRecallSettings } from "../../../../src/shared/types/settings.types";

const mockOpen = vi.fn();
vi.mock("../../../../src/shared/ui/modals/SubscriptionPromoModal", () => ({
	SubscriptionPromoModal: class {
		constructor(public plugin: unknown) {}
		open = mockOpen;
	},
}));

function createMockPlugin(
	settingsOverrides: Partial<TrueRecallSettings> = {},
): TrueRecallPlugin {
	return {
		settings: {
			openRouterApiKey: "",
			...settingsOverrides,
		},
	} as unknown as TrueRecallPlugin;
}

describe("maybeShowSubscriptionPromo", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockOpen.mockClear();
		// Reset module state (shownThisSession flag)
		vi.resetModules();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows modal when no API key is set", async () => {
		const { maybeShowSubscriptionPromo } = await import(
			"../../../../src/shared/ui/modals/subscription-promo"
		);
		const plugin = createMockPlugin();

		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);

		expect(mockOpen).toHaveBeenCalledOnce();
	});

	it("skips if user has openRouterApiKey", async () => {
		const { maybeShowSubscriptionPromo } = await import(
			"../../../../src/shared/ui/modals/subscription-promo"
		);
		const plugin = createMockPlugin({ openRouterApiKey: "sk-test" });

		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);

		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("only shows once per session", async () => {
		const { maybeShowSubscriptionPromo } = await import(
			"../../../../src/shared/ui/modals/subscription-promo"
		);
		const plugin = createMockPlugin();

		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);
		expect(mockOpen).toHaveBeenCalledOnce();

		mockOpen.mockClear();
		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);
		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("delays modal by 600ms", async () => {
		const { maybeShowSubscriptionPromo } = await import(
			"../../../../src/shared/ui/modals/subscription-promo"
		);
		const plugin = createMockPlugin();

		await maybeShowSubscriptionPromo(plugin);

		await vi.advanceTimersByTimeAsync(500);
		expect(mockOpen).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(200);
		expect(mockOpen).toHaveBeenCalledOnce();
	});
});
