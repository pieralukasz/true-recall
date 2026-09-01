/**
 * Cloud Sync multi-device E2E
 *
 * Runs the full production sync pipeline end to end: two devices, each with a
 * real sql.js-backed database and the real persistence action classes, syncing
 * through an in-memory server that implements the production exchange contract
 * (LWW, device tie-break, revision cursors, edge-function limits). Only the
 * HTTP transport is replaced.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CloudSyncService } from "../../../src/integration/cloud/cloud-sync.service";
import type { CloudSyncResult } from "../../../src/integration/cloud/cloud-sync.types";
import type { SqliteStoreService } from "../../../src/persistence/sqlite/SqliteStoreService";
import {
	createTestCard,
	createTestContext,
	type TestContext,
} from "../../persistence/sqlite/__setup__/test-database";
import { InMemoryCloudServer } from "./__setup__/in-memory-cloud-server";

const BASE_TIME = new Date("2026-09-01T10:00:00Z").getTime();

interface Device {
	ctx: TestContext;
	sync: () => Promise<CloudSyncResult>;
	close: () => void;
}

let now = BASE_TIME;
const openDevices: Device[] = [];

function tick(ms = 1_000): number {
	now += ms;
	vi.setSystemTime(now);
	return now;
}

async function createDevice(
	server: InMemoryCloudServer,
	deviceId: string,
): Promise<Device> {
	const ctx = await createTestContext();
	const store = {
		transaction: <T>(fn: () => T) => ctx.db.transaction(fn),
		cards: ctx.cards,
		notes: ctx.notes,
		noteTypes: ctx.noteTypes,
		stats: ctx.stats,
	} as unknown as SqliteStoreService;
	const service = new CloudSyncService(store, server.transportFor(deviceId), {
		accountId: "account-e2e",
		deviceId,
	});
	const device: Device = {
		ctx,
		sync: () => service.sync(),
		close: () => ctx.close(),
	};
	openDevices.push(device);
	return device;
}

async function syncOk(device: Device): Promise<CloudSyncResult> {
	const result = await device.sync();
	expect(result.errors).toEqual([]);
	return result;
}

function activeCardIds(ctx: TestContext, sourceUid: string): string[] {
	return ctx.db
		.query<{ id: string }>(
			`SELECT id FROM cards WHERE deleted_at IS NULL AND source_uid = ? ORDER BY id`,
			[sourceUid],
		)
		.map((row) => row.id);
}

function cardStability(ctx: TestContext, cardId: string): number | null {
	return (
		ctx.db.get<{ stability: number }>(
			`SELECT stability FROM cards WHERE id = ?`,
			[cardId],
		)?.stability ?? null
	);
}

describe("Cloud Sync multi-device E2E", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date"] });
		now = BASE_TIME;
		vi.setSystemTime(now);
	});

	afterEach(() => {
		for (const device of openDevices.splice(0)) device.close();
		vi.useRealTimers();
	});

	it("propagates a card created on one device to another", async () => {
		const server = new InMemoryCloudServer();
		const deviceA = await createDevice(server, "device-a");
		const deviceB = await createDevice(server, "device-b");

		tick();
		deviceA.ctx.cards.set(
			"card-a1",
			createTestCard({
				id: "card-a1",
				question: "Capital of Poland?",
				answer: "Warsaw",
			}),
		);
		await syncOk(deviceA);
		await syncOk(deviceB);

		const pulled = deviceB.ctx.cards
			.getAllIncludingDeleted()
			.find((card) => card.id === "card-a1");
		expect(pulled?.question).toBe("Capital of Poland?");
		expect(pulled?.answer).toBe("Warsaw");
	});

	it("does not echo pulled rows back to the server", async () => {
		const server = new InMemoryCloudServer();
		const deviceA = await createDevice(server, "device-a");
		const deviceB = await createDevice(server, "device-b");

		tick();
		deviceA.ctx.cards.set("card-a1", createTestCard({ id: "card-a1" }));
		await syncOk(deviceA);
		await syncOk(deviceB);

		const revisionAfterPull = server.revisionCount;
		const secondSync = await syncOk(deviceB);

		expect(secondSync.pushed).toBe(0);
		expect(server.revisionCount).toBe(revisionAfterPull);
	});

	it("keeps uploading local changes after pulling from a device with a fast clock", async () => {
		const server = new InMemoryCloudServer();
		const deviceA = await createDevice(server, "device-a");
		const deviceB = await createDevice(server, "device-b");

		tick();
		deviceA.ctx.cards.set("card-skew", createTestCard({ id: "card-skew" }));
		// Device A's clock runs a day ahead.
		const dayAhead = now + 26 * 60 * 60 * 1000;
		deviceA.ctx.db.run(`UPDATE cards SET updated_at = ? WHERE id = ?`, [
			dayAhead,
			"card-skew",
		]);
		await syncOk(deviceA);
		await syncOk(deviceB);

		// The potential echo sync must not push the future-stamped row back.
		const echoSync = await syncOk(deviceB);
		expect(echoSync.pushed).toBe(0);

		tick();
		deviceB.ctx.cards.set(
			"card-b-local",
			createTestCard({ id: "card-b-local" }),
		);
		const pushSync = await syncOk(deviceB);

		expect(pushSync.pushed).toBeGreaterThan(0);
		expect(server.entity("card", "card-b-local")).toBeDefined();
	});

	it("converges both devices after equal-timestamp concurrent edits", async () => {
		const server = new InMemoryCloudServer();
		const deviceA = await createDevice(server, "device-a");
		const deviceB = await createDevice(server, "device-b");

		tick();
		deviceA.ctx.cards.set("card-tie", createTestCard({ id: "card-tie" }));
		await syncOk(deviceA);
		await syncOk(deviceB);

		// Both devices edit the same card in the same millisecond.
		const tieTimestamp = tick();
		deviceA.ctx.db.run(
			`UPDATE cards SET stability = ?, updated_at = ? WHERE id = ?`,
			[1.5, tieTimestamp, "card-tie"],
		);
		deviceB.ctx.db.run(
			`UPDATE cards SET stability = ?, updated_at = ? WHERE id = ?`,
			[7.25, tieTimestamp, "card-tie"],
		);

		await syncOk(deviceA);
		await syncOk(deviceB);
		// Device A pulls the tie loss in a later sync and must still converge.
		await syncOk(deviceA);

		expect(server.entity("card", "card-tie")?.sourceDeviceId).toBe("device-b");
		expect(cardStability(deviceB.ctx, "card-tie")).toBe(7.25);
		expect(cardStability(deviceA.ctx, "card-tie")).toBe(7.25);
	});

	it("recovers remote reviews and daily stats after a sync interrupted mid-pull", async () => {
		const server = new InMemoryCloudServer(2);
		const deviceA = await createDevice(server, "device-a");
		const deviceB = await createDevice(server, "device-b");

		// Baseline: both devices exchange their builtin rows first.
		await syncOk(deviceA);
		await syncOk(deviceB);

		tick();
		deviceA.ctx.cards.set("card-rev", createTestCard({ id: "card-rev" }));
		tick();
		deviceA.ctx.stats.addReviewLog("card-rev", 3, 1, 0, 1, 4_000);
		await syncOk(deviceA);

		// Page size 2 splits the pull; the second request dies mid-sync.
		server.planFailure(2);
		const failed = await deviceB.sync();
		expect(failed.errors).toEqual(["network down"]);

		await syncOk(deviceB);

		expect(deviceB.ctx.stats.getTotalReviewCount()).toBe(1);
		const stats = deviceB.ctx.db.get<{ total: number }>(
			`SELECT COALESCE(SUM(reviews_completed), 0) AS total FROM daily_stats`,
		);
		expect(stats?.total).toBe(1);
	});

	it("propagates deletions as tombstones", async () => {
		const server = new InMemoryCloudServer();
		const deviceA = await createDevice(server, "device-a");
		const deviceB = await createDevice(server, "device-b");

		tick();
		deviceA.ctx.cards.set("card-del", createTestCard({ id: "card-del" }));
		await syncOk(deviceA);
		await syncOk(deviceB);

		tick();
		deviceA.ctx.cards.softDelete("card-del");
		await syncOk(deviceA);
		await syncOk(deviceB);

		const row = deviceB.ctx.db.get<{ deleted_at: number | null }>(
			`SELECT deleted_at FROM cards WHERE id = ?`,
			["card-del"],
		);
		expect(row?.deleted_at).not.toBeNull();
	});

	it("merges duplicate cards created concurrently on two devices", async () => {
		const server = new InMemoryCloudServer();
		const deviceA = await createDevice(server, "device-a");
		const deviceB = await createDevice(server, "device-b");

		tick();
		deviceA.ctx.cards.set(
			"card-dup-a",
			createTestCard({
				id: "card-dup-a",
				sourceUid: "note-dup",
				question: "Duplicate question",
				answer: "Duplicate answer",
				createdAt: now,
			}),
		);
		tick();
		deviceB.ctx.cards.set(
			"card-dup-b",
			createTestCard({
				id: "card-dup-b",
				sourceUid: "note-dup",
				question: "Duplicate question",
				answer: "Duplicate answer",
				createdAt: now,
			}),
		);

		await syncOk(deviceA);
		// Device B pulls A's twin and merges its own newer duplicate locally.
		await syncOk(deviceB);
		// Device B uploads the tombstone; device A pulls it.
		await syncOk(deviceB);
		await syncOk(deviceA);

		expect(activeCardIds(deviceB.ctx, "note-dup")).toEqual(["card-dup-a"]);
		expect(activeCardIds(deviceA.ctx, "note-dup")).toEqual(["card-dup-a"]);
	});

	it("pushes a collection larger than the request size limit in multiple requests", async () => {
		const server = new InMemoryCloudServer();
		const deviceA = await createDevice(server, "device-a");
		const deviceB = await createDevice(server, "device-b");

		const bigAnswer = "x".repeat(2_500_000);
		tick();
		for (const id of ["card-big-1", "card-big-2", "card-big-3"]) {
			deviceA.ctx.cards.set(
				id,
				createTestCard({ id, question: `Question ${id}`, answer: bigAnswer }),
			);
		}

		const pushSync = await syncOk(deviceA);
		expect(pushSync.pushed).toBeGreaterThanOrEqual(3);

		await syncOk(deviceB);
		for (const id of ["card-big-1", "card-big-2", "card-big-3"]) {
			const card = deviceB.ctx.cards
				.getAllIncludingDeleted()
				.find((candidate) => candidate.id === id);
			expect(card?.answer).toHaveLength(bigAnswer.length);
		}
	});
});
