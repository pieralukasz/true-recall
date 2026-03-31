import { jsx as _jsx } from "preact/jsx-runtime";
import { CustomStudyBody } from "@true-recall/obsidian/modals/study/custom-study/CustomStudyBody";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { render } from "preact";
export class CustomStudyModal extends BasePromiseModal {
    constructor(app, options, studyScope) {
        super(app, options);
        this.studyScope = studyScope;
    }
    getDefaultResult() {
        return { cancelled: true };
    }
    renderBody(container) {
        var _a;
        render(_jsx(CustomStudyBody, { scopeLabel: (_a = this.studyScope) === null || _a === void 0 ? void 0 : _a.scopeLabel, onResolve: (result) => {
                // Attach scope filters from the class-level studyScope
                if (result.sessionResult && this.studyScope) {
                    result.sessionResult.sourceNoteFilters =
                        this.studyScope.sourceNoteFilters;
                }
                this.resolve(result);
            } }), container);
    }
}
