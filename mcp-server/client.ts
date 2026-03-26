const DEFAULT_PORT = 27182;
const BASE_URL = `http://127.0.0.1:${process.env.TRUE_RECALL_PORT ?? DEFAULT_PORT}`;

interface ApiResponse<T = unknown> {
	ok: boolean;
	data?: T;
	error?: string;
}

export class TrueRecallClient {
	private baseUrl: string;

	constructor(port?: number) {
		this.baseUrl = port
			? `http://127.0.0.1:${port}`
			: BASE_URL;
	}

	async get<T>(path: string): Promise<T> {
		const res = await fetch(`${this.baseUrl}${path}`);
		const body = (await res.json()) as ApiResponse<T>;
		if (!body.ok) {
			throw new Error(body.error ?? `Request failed: ${res.status}`);
		}
		return body.data as T;
	}

	async post<T>(path: string, data?: unknown): Promise<T> {
		const res = await fetch(`${this.baseUrl}${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: data !== undefined ? JSON.stringify(data) : undefined,
		});
		const body = (await res.json()) as ApiResponse<T>;
		if (!body.ok) {
			throw new Error(body.error ?? `Request failed: ${res.status}`);
		}
		return body.data as T;
	}

	async delete<T>(path: string): Promise<T> {
		const res = await fetch(`${this.baseUrl}${path}`, {
			method: "DELETE",
		});
		const body = (await res.json()) as ApiResponse<T>;
		if (!body.ok) {
			throw new Error(body.error ?? `Request failed: ${res.status}`);
		}
		return body.data as T;
	}

	async isAvailable(): Promise<boolean> {
		try {
			await this.get("/status");
			return true;
		} catch {
			return false;
		}
	}
}
