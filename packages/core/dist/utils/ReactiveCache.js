import { __awaiter } from "tslib";
export class ReactiveCache {
    constructor(options) {
        var _a, _b;
        this.cachedValue = null;
        this.cacheTimestamp = 0;
        this.computing = false;
        this.pendingPromise = null;
        this.disposer = null;
        this.disposed = false;
        this.compute = options.compute;
        this.ttlMs = (_a = options.ttlMs) !== null && _a !== void 0 ? _a : 0;
        this.label = (_b = options.label) !== null && _b !== void 0 ? _b : "ReactiveCache";
        if (options.subscribe) {
            this.disposer = options.subscribe(() => this.invalidate());
        }
    }
    get() {
        return __awaiter(this, arguments, void 0, function* (forceRefresh = false) {
            if (this.disposed) {
                throw new Error(`[${this.label}] Cache has been disposed`);
            }
            const now = Date.now();
            if (!forceRefresh && this.cachedValue !== null) {
                if (this.ttlMs === 0 || now - this.cacheTimestamp < this.ttlMs) {
                    return this.cachedValue;
                }
            }
            if (this.computing && this.pendingPromise) {
                return this.pendingPromise;
            }
            this.computing = true;
            this.pendingPromise = this.compute()
                .then((value) => {
                this.cachedValue = value;
                this.cacheTimestamp = Date.now();
                return value;
            })
                .finally(() => {
                this.computing = false;
                this.pendingPromise = null;
            });
            return this.pendingPromise;
        });
    }
    invalidate() {
        if (this.disposed)
            return;
        this.cachedValue = null;
        this.cacheTimestamp = 0;
    }
    hasValue() {
        if (this.cachedValue === null)
            return false;
        if (this.ttlMs === 0)
            return true;
        return Date.now() - this.cacheTimestamp < this.ttlMs;
    }
    getStats() {
        return {
            hasValue: this.cachedValue !== null,
            ageMs: this.cachedValue !== null ? Date.now() - this.cacheTimestamp : 0,
            computing: this.computing,
        };
    }
    dispose() {
        var _a;
        if (this.disposed)
            return;
        this.disposed = true;
        (_a = this.disposer) === null || _a === void 0 ? void 0 : _a.call(this);
        this.disposer = null;
        this.cachedValue = null;
        this.pendingPromise = null;
    }
}
