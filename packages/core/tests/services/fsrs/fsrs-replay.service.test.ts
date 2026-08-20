/**
 * FsrsReplayService Tests
 * Replay must be deterministic (same merged log set => same state on every
 * device) and must reproduce the live scheduling path for a linear history.
 */

import { describe, expect, it } from "vitest";

import { FSRSService } from "../../../src/services/fsrs/fsrs.service";
import {
	FsrsReplayService,
	type ReplayLogEntry,
} from "../../../src/services/fsrs/fsrs-replay.service";
import type { FSRSSettings } from "../../../src/types/settings.types";

const SETTINGS: FSRSSettings = {
	requestRetention: 0.9,
	maximumInterval: 36500,
	weights: null,
	enableFuzz: true,
	learningSteps: [1, 10],
	relearningSteps: [10],
	enableShortTerm: true,
};

function makeLog(
	overrides: Partial<ReplayLogEntry> & { id: string },
): ReplayLogEntry {
	return {
		reviewedAt: "2026-02-01T10:00:00.000Z",
		rating: 3,
		presetName: null,
		deviceId: "device-a",
		reviewKind: "review",
		deletedAt: null,
		...overrides,
	};
}

describe("FsrsReplayService", () => {
	const fsrsService = new FSRSService(SETTINGS);
	const replayService = new FsrsReplayService(fsrsService, () => SETTINGS);

	it("reproduces the live scheduling path for a linear history", () => {
		const times = [
			"2026-02-01T10:00:00.000Z",
			"2026-02-01T10:11:00.000Z",
			"2026-02-03T09:00:00.000Z",
			"2026-02-10T09:00:00.000Z",
		];
		const ratings = [3, 3, 4, 2];

		let live = fsrsService.createNewCard("card-1");
		for (let i = 0; i < times.length; i++) {
			live = fsrsService.scheduleCard(
				live,
				ratings[i] as 1 | 2 | 3 | 4,
				new Date(times[i] as string),
				SETTINGS,
			);
		}

		const logs = times.map((t, i) =>
			makeLog({
				id: `log-${i}`,
				reviewedAt: t,
				rating: ratings[i] as number,
			}),
		);
		const replayed = replayService.replayCard("card-1", logs);

		expect(replayed).not.toBeNull();
		expect(replayed?.due).toBe(live.due);
		expect(replayed?.stability).toBe(live.stability);
		expect(replayed?.difficulty).toBe(live.difficulty);
		expect(replayed?.reps).toBe(live.reps);
		expect(replayed?.state).toBe(live.state);
	});

	it("is independent of input order (merged two-device history)", () => {
		const logs = [
			makeLog({
				id: "a1",
				deviceId: "device-a",
				reviewedAt: "2026-02-01T10:00:00.000Z",
				rating: 3,
			}),
			makeLog({
				id: "b1",
				deviceId: "device-b",
				reviewedAt: "2026-02-02T10:00:00.000Z",
				rating: 1,
			}),
			makeLog({
				id: "a2",
				deviceId: "device-a",
				reviewedAt: "2026-02-03T10:00:00.000Z",
				rating: 4,
			}),
		];
		const shuffled = [logs[2], logs[0], logs[1]] as ReplayLogEntry[];

		const forward = replayService.replayCard("card-1", logs);
		const reversed = replayService.replayCard("card-1", shuffled);

		expect(forward).toEqual(reversed);
		expect(forward?.reps).toBe(3);
	});

	it("breaks reviewedAt ties deterministically by device id then log id", () => {
		const sameInstant = "2026-02-01T10:00:00.000Z";
		const logs = [
			makeLog({
				id: "z",
				deviceId: "device-b",
				reviewedAt: sameInstant,
				rating: 1,
			}),
			makeLog({
				id: "a",
				deviceId: "device-a",
				reviewedAt: sameInstant,
				rating: 4,
			}),
		];

		const result1 = replayService.replayCard("card-1", logs);
		const result2 = replayService.replayCard("card-1", [
			logs[1] as ReplayLogEntry,
			logs[0] as ReplayLogEntry,
		]);

		expect(result1).toEqual(result2);
	});

	it("skips preview and tombstoned entries; returns null when nothing remains", () => {
		const onlyNoise = [
			makeLog({ id: "p", reviewKind: "preview" }),
			makeLog({ id: "d", deletedAt: Date.now() }),
		];

		expect(replayService.replayCard("card-1", onlyNoise)).toBeNull();

		const mixed = [
			...onlyNoise,
			makeLog({
				id: "real",
				reviewedAt: "2026-02-01T10:00:00.000Z",
				rating: 3,
			}),
		];
		const replayed = replayService.replayCard("card-1", mixed);
		expect(replayed?.reps).toBe(1);
	});
});
