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

import {
	maybeShowSubscriptionPromo,
	SNOOZE_INTERVALS_MS,
} from "../../../../src/shared/ui/modals/subscription-promo";

function createMockPlugin(
	settingsOverrides: Partial<TrueRecallSettings> = {},
): TrueRecallPlugin {
	return {
		settings: {
			subscriptionPromoSnoozedUntil: undefined,
			subscriptionPromoSnoozeCount: undefined,
			subscriptionKey: undefined,
			...settingsOverrides,
		},
		saveSettings: vi.fn().mockResolvedValue(undefined),
	} as unknown as TrueRecallPlugin;
}

describe("maybeShowSubscriptionPromo", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		mockOpen.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows modal for fresh BYOK user (no snooze data)", async () => {
		const plugin = createMockPlugin({ openRouterApiKey: "sk-test" });

		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);

		expect(mockOpen).toHaveBeenCalledOnce();
	});

	it("skips if user has subscription key", async () => {
		const plugin = createMockPlugin({ subscriptionKey: "tr-abc123" });

		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);

		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("skips if snoozedUntil is in the future", async () => {
		const plugin = createMockPlugin({
			subscriptionPromoSnoozedUntil: Date.now() + 999_999,
			subscriptionPromoSnoozeCount: 1,
		});

		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);

		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("shows modal when snoozedUntil is in the past", async () => {
		const plugin = createMockPlugin({
			subscriptionPromoSnoozedUntil: Date.now() - 1000,
			subscriptionPromoSnoozeCount: 1,
		});

		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);

		expect(mockOpen).toHaveBeenCalledOnce();
	});

	it("skips when snoozeCount >= 3 (permanently dismissed)", async () => {
		const plugin = createMockPlugin({
			subscriptionPromoSnoozeCount: SNOOZE_INTERVALS_MS.length + 1,
		});

		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);

		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("skips at exactly the permanent dismiss threshold", async () => {
		const plugin = createMockPlugin({
			subscriptionPromoSnoozeCount: 3,
		});

		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);

		expect(mockOpen).not.toHaveBeenCalled();
	});

	it("shows modal at count=2 with expired snooze (last chance)", async () => {
		const plugin = createMockPlugin({
			subscriptionPromoSnoozeCount: 2,
			subscriptionPromoSnoozedUntil: Date.now() - 1,
		});

		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);

		expect(mockOpen).toHaveBeenCalledOnce();
	});

	it("delays modal by 600ms", async () => {
		const plugin = createMockPlugin();

		await maybeShowSubscriptionPromo(plugin);

		await vi.advanceTimersByTimeAsync(500);
		expect(mockOpen).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(200);
		expect(mockOpen).toHaveBeenCalledOnce();
	});

	it("shows modal when no keys at all", async () => {
		const plugin = createMockPlugin();

		await maybeShowSubscriptionPromo(plugin);
		await vi.advanceTimersByTimeAsync(700);

		expect(mockOpen).toHaveBeenCalledOnce();
	});
});
