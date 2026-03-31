import { __awaiter } from "tslib";
import { GITHUB_RELEASES_API } from "@true-recall/core/constants";
import { requestUrl } from "obsidian";
export function fetchLatestRelease() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const response = yield requestUrl({
                url: GITHUB_RELEASES_API,
                method: "GET",
                headers: { Accept: "application/vnd.github.v3+json" },
            });
            if (response.status !== 200)
                return null;
            const data = response.json;
            return {
                version: data.tag_name.replace(/^v/, ""),
                name: (_a = data.name) !== null && _a !== void 0 ? _a : data.tag_name,
                body: (_b = data.body) !== null && _b !== void 0 ? _b : "",
                publishedAt: data.published_at,
                htmlUrl: data.html_url,
            };
        }
        catch (_c) {
            return null;
        }
    });
}
