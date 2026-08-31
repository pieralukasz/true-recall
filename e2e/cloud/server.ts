/**
 * Isolated Cloud Sync backend for desktop/mobile E2E tests.
 *
 * It implements the same HTTP contract as the website auth exchange and the
 * Supabase Edge Function without touching production accounts or data.
 */

const PORT = Number(process.env.E2E_CLOUD_PORT ?? 4174);
const HOST = process.env.E2E_CLOUD_HOST ?? "127.0.0.1";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000042";
const ACCOUNT_EMAIL = "cloud-sync-e2e@truerecall.local";
const ENTITY_TYPES = new Set(["note_type", "note", "card", "review_log"]);

interface Authorization {
	challenge: string;
	deviceId: string;
	deviceName: string;
	state: string;
	used: boolean;
}

interface Device {
	deviceId: string;
	deviceName: string;
	revoked: boolean;
}

interface Change {
	entityType: string;
	entityId: string;
	updatedAt: number;
	payload: Record<string, unknown>;
	sourceDeviceId?: string;
}

interface StoredChange extends Change {
	serverRevision: number;
	sourceDeviceId: string;
}

const authorizations = new Map<string, Authorization>();
const devices = new Map<string, Device>();
const entities = new Map<string, StoredChange>();
let revision = 0;

function json(body: unknown, status = 200): Response {
	return Response.json(body, {
		status,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Cache-Control": "no-store",
		},
	});
}

function base64Url(bytes: Uint8Array): string {
	return Buffer.from(bytes)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

async function challengeFor(verifier: string): Promise<string> {
	return base64Url(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)),
		),
	);
}

function deviceFor(request: Request): Device | null {
	const token = request.headers
		.get("Authorization")
		?.replace(/^Bearer\s+/i, "")
		.trim();
	if (!token) return null;
	const device = devices.get(token);
	return device && !device.revoked ? device : null;
}

function isChange(value: unknown): value is Change {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const change = value as Partial<Change>;
	return (
		typeof change.entityType === "string" &&
		ENTITY_TYPES.has(change.entityType) &&
		typeof change.entityId === "string" &&
		change.entityId.length > 0 &&
		Number.isSafeInteger(change.updatedAt) &&
		Number(change.updatedAt) >= 0 &&
		!!change.payload &&
		typeof change.payload === "object" &&
		!Array.isArray(change.payload)
	);
}

function authPage(url: URL): Response {
	const state = url.searchParams.get("state") ?? "";
	const challenge = url.searchParams.get("challenge") ?? "";
	const deviceId = url.searchParams.get("device_id") ?? "";
	const deviceName = url.searchParams.get("device_name") ?? "";
	const vault = url.searchParams.get("vault") ?? "";
	if (state.length < 16 || challenge.length < 32 || !deviceId || !deviceName) {
		return new Response("Invalid E2E authorization request", { status: 400 });
	}
	const code = crypto.randomUUID();
	authorizations.set(code, {
		challenge,
		deviceId,
		deviceName,
		state,
		used: false,
	});
	const callback = new URL("obsidian://true-recall-auth");
	callback.searchParams.set("code", code);
	callback.searchParams.set("state", state);
	if (vault) callback.searchParams.set("vault", vault);
	const callbackUrl = callback.toString();
	const escapedCallback = JSON.stringify(callbackUrl);
	return new Response(
		`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>True Recall E2E</title></head><body><main><h1>True Recall Cloud Sync E2E</h1><p>Authorized ${deviceName.replace(/[<>&]/g, "")} for the isolated test account.</p><a id="open" href="${callbackUrl.replace(/&/g, "&amp;")}">Open Obsidian</a></main><script>setTimeout(() => { window.location.href = ${escapedCallback}; }, 250);</script></body></html>`,
		{
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "no-store",
			},
		},
	);
}

async function exchangeAuth(request: Request): Promise<Response> {
	let body: {
		code?: string;
		state?: string;
		verifier?: string;
		deviceId?: string;
		deviceName?: string;
	};
	try {
		body = await request.json();
	} catch {
		return json({ error: "Invalid JSON" }, 400);
	}
	const authorization = body.code ? authorizations.get(body.code) : undefined;
	if (
		!authorization ||
		authorization.used ||
		authorization.state !== body.state ||
		authorization.deviceId !== body.deviceId ||
		!body.verifier ||
		authorization.challenge !== (await challengeFor(body.verifier))
	) {
		return json({ error: "Invalid or expired authorization code" }, 401);
	}
	authorization.used = true;
	for (const device of devices.values()) {
		if (device.deviceId === authorization.deviceId) device.revoked = true;
	}
	const token = base64Url(crypto.getRandomValues(new Uint8Array(48)));
	devices.set(token, {
		deviceId: authorization.deviceId,
		deviceName: body.deviceName ?? authorization.deviceName,
		revoked: false,
	});
	return json({
		deviceToken: token,
		userId: ACCOUNT_ID,
		email: ACCOUNT_EMAIL,
	});
}

async function cloudSync(request: Request): Promise<Response> {
	const device = deviceFor(request);
	if (!device) return json({ error: "Unauthorized" }, 401);
	if (request.method === "DELETE") {
		device.revoked = true;
		return json({ ok: true });
	}
	if (request.method !== "POST") {
		return json({ error: "Method not allowed" }, 405);
	}
	let body: { cursor?: unknown; changes?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ error: "Invalid JSON" }, 400);
	}
	if (
		!Number.isSafeInteger(body.cursor) ||
		Number(body.cursor) < 0 ||
		!Array.isArray(body.changes) ||
		body.changes.length > 400 ||
		!body.changes.every(isChange)
	) {
		return json({ error: "Invalid sync request" }, 400);
	}
	for (const change of body.changes) {
		const key = `${change.entityType}:${change.entityId}`;
		const current = entities.get(key);
		if (
			current &&
			(change.updatedAt < current.updatedAt ||
				(change.updatedAt === current.updatedAt &&
					device.deviceId <= current.sourceDeviceId))
		) {
			continue;
		}
		revision += 1;
		entities.set(key, {
			...change,
			sourceDeviceId: device.deviceId,
			serverRevision: revision,
		});
	}
	const cursor = Number(body.cursor);
	const page = [...entities.values()]
		.filter((change) => change.serverRevision > cursor)
		.sort((left, right) => left.serverRevision - right.serverRevision)
		.slice(0, 500);
	const nextCursor = page.at(-1)?.serverRevision ?? cursor;
	return json({
		changes: page.map(({ serverRevision: _, ...change }) => change),
		cursor: nextCursor,
		hasMore: [...entities.values()].some(
			(change) => change.serverRevision > nextCursor,
		),
	});
}

function status(): Response {
	return json({
		activeDevices: [...devices.values()].filter((device) => !device.revoked),
		entities: [...entities.values()]
			.sort((left, right) => left.serverRevision - right.serverRevision)
			.map(({ payload: _, ...entity }) => entity),
		revision,
	});
}

const server = Bun.serve({
	hostname: HOST,
	port: PORT,
	async fetch(request) {
		const url = new URL(request.url);
		if (request.method === "OPTIONS") return new Response("ok");
		if (request.method === "GET" && url.pathname === "/auth/plugin") {
			return authPage(url);
		}
		if (request.method === "POST" && url.pathname === "/api/auth/exchange") {
			return exchangeAuth(request);
		}
		if (url.pathname === "/cloud-sync") return cloudSync(request);
		if (request.method === "GET" && url.pathname === "/__status") {
			return status();
		}
		return json({ error: "Not found" }, 404);
	},
});

console.log(`True Recall Cloud Sync E2E backend: ${server.url}`);
