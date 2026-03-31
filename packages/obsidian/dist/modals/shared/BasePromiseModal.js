import { __awaiter } from "tslib";
import { BaseModal } from "@true-recall/obsidian/modals/shared/BaseModal";
export class BasePromiseModal extends BaseModal {
    constructor() {
        super(...arguments);
        this.resolvePromise = null;
        this.hasResolved = false;
    }
    openAndWait() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                this.resolvePromise = resolve;
                this.open();
            });
        });
    }
    resolve(result) {
        if (this.hasResolved)
            return;
        this.hasResolved = true;
        if (this.resolvePromise) {
            this.resolvePromise(result);
            this.resolvePromise = null;
        }
        this.close();
    }
    onClose() {
        // Unmount Preact tree first (via BaseModal)
        super.onClose();
        if (!this.hasResolved && this.resolvePromise) {
            this.resolvePromise(this.getDefaultResult());
            this.resolvePromise = null;
        }
    }
}
export function createCancelledResult(additionalProps) {
    return Object.assign({ cancelled: true }, additionalProps);
}
