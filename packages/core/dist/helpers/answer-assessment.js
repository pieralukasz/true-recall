import { stripMarkdownSyntax } from "@true-recall/core/utils";
function normalizeAnswer(text) {
    return stripMarkdownSyntax(text)
        .toLowerCase()
        .replace(/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function tokenize(text) {
    if (!text)
        return [];
    return text.split(" ").filter((token) => token.length > 0);
}
function buildLcsTable(expected, user) {
    var _a, _b, _c, _d, _e;
    const rows = expected.length + 1;
    const cols = user.length + 1;
    const table = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    for (let i = expected.length - 1; i >= 0; i--) {
        const row = table[i];
        if (!row)
            continue;
        for (let j = user.length - 1; j >= 0; j--) {
            const expectedToken = expected[i];
            const userToken = user[j];
            if (!expectedToken || !userToken)
                continue;
            if (expectedToken === userToken) {
                row[j] = ((_b = (_a = table[i + 1]) === null || _a === void 0 ? void 0 : _a[j + 1]) !== null && _b !== void 0 ? _b : 0) + 1;
            }
            else {
                row[j] = Math.max((_d = (_c = table[i + 1]) === null || _c === void 0 ? void 0 : _c[j]) !== null && _d !== void 0 ? _d : 0, (_e = row[j + 1]) !== null && _e !== void 0 ? _e : 0);
            }
        }
    }
    return table;
}
function buildDiffTokens(expected, user) {
    var _a, _b, _c, _d;
    const table = buildLcsTable(expected, user);
    const diff = [];
    let i = 0;
    let j = 0;
    while (i < expected.length && j < user.length) {
        const expectedToken = expected[i];
        const userToken = user[j];
        if (!expectedToken || !userToken)
            break;
        if (expectedToken === userToken) {
            diff.push({ text: expectedToken, type: "match" });
            i++;
            j++;
            continue;
        }
        const skipExpected = (_b = (_a = table[i + 1]) === null || _a === void 0 ? void 0 : _a[j]) !== null && _b !== void 0 ? _b : 0;
        const skipUser = (_d = (_c = table[i]) === null || _c === void 0 ? void 0 : _c[j + 1]) !== null && _d !== void 0 ? _d : 0;
        if (skipExpected >= skipUser) {
            diff.push({ text: expectedToken, type: "missing" });
            i++;
        }
        else {
            diff.push({ text: userToken, type: "extra" });
            j++;
        }
    }
    while (i < expected.length) {
        const expectedToken = expected[i];
        if (expectedToken) {
            diff.push({ text: expectedToken, type: "missing" });
        }
        i++;
    }
    while (j < user.length) {
        const userToken = user[j];
        if (userToken) {
            diff.push({ text: userToken, type: "extra" });
        }
        j++;
    }
    return diff;
}
export function assessTypedAnswer(expectedAnswer, userAnswer) {
    const normalizedExpected = normalizeAnswer(expectedAnswer);
    const normalizedUser = normalizeAnswer(userAnswer);
    const expectedTokens = tokenize(normalizedExpected);
    const userTokens = tokenize(normalizedUser);
    const diff = buildDiffTokens(expectedTokens, userTokens);
    const matchedCount = diff.filter((token) => token.type === "match").length;
    const denominator = expectedTokens.length;
    const score = denominator === 0
        ? userTokens.length === 0
            ? 100
            : 0
        : Math.round((matchedCount / denominator) * 100);
    return {
        score,
        diff,
    };
}
