const DEFAULT_PORT = 27182;
const DEFAULT_TIMEOUT_MS = 30_000;

type ApiResponse<T = unknown> =
	| { ok: true; data: T }
	| { ok: false; error: string };

const CONNECTION_ERROR_MSG =
	"Cannot connect to True Recall plugin. Is Obsidian running with the Local API enabled? " +
	"Enable it in Settings → General → Local API.";

export class TrueRecallClient {
	private baseUrl: string;

	constructor(port?: number) {
		const p = port ?? (Number(process.env.TRUE_RECALL_PORT) || DEFAULT_PORT);
		this.baseUrl = `http://127.0.0.1:${p}`;
	}

	private async request<T>(
		path: string,
		init?: RequestInit,
		timeoutMs = DEFAULT_TIMEOUT_MS,
	): Promise<T> {
		let res: Response;
		try {
			res = await fetch(`${this.baseUrl}${path}`, {
				...init,
				signal: AbortSignal.timeout(timeoutMs),
			});
		} catch (error) {
			if (error instanceof DOMException && error.name === "TimeoutError") {
				throw new Error(
					`Request to ${path} timed out after ${timeoutMs / 1000}s. The plugin may be busy.`,
				);
			}
			throw new Error(
				`${CONNECTION_ERROR_MSG} (${error instanceof Error ? error.message : String(error)})`,
			);
		}

		let body: ApiResponse<T>;
		try {
			body = (await res.json()) as ApiResponse<T>;
		} catch {
			throw new Error(
				`True Recall API returned invalid JSON (HTTP ${res.status}). The plugin may be in an error state.`,
			);
		}

		if (!body.ok) {
			throw new Error(body.error ?? `Request failed: ${res.status}`);
		}
		return body.data;
	}

	async get<T>(path: string): Promise<T> {
		return this.request<T>(path);
	}

	async post<T>(path: string, data?: unknown): Promise<T> {
		return this.request<T>(path, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: data !== undefined ? JSON.stringify(data) : undefined,
		});
	}

	async delete<T>(path: string): Promise<T> {
		return this.request<T>(path, { method: "DELETE" });
	}

	async isAvailable(): Promise<boolean> {
		try {
			await this.get("/status");
			return true;
		} catch (error) {
			console.error(
				`[TrueRecallClient] Health check failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			return false;
		}
	}
}
