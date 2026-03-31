/**
 * Platform adapter for HTTP requests.
 * Obsidian: wraps requestUrl()
 * Desktop: wraps fetch()
 */
export interface IHttpClient {
    post(url: string, body: unknown, headers?: Record<string, string>): Promise<{
        status: number;
        json: unknown;
        text: string;
    }>;
    stream(url: string, body: unknown, headers?: Record<string, string>): AsyncIterable<string>;
}
