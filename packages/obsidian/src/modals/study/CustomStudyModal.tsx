import type { App } from "obsidian";
import { render } from "preact";

import type { BaseModalOptions } from "@true-recall/obsidian/modals/shared/BaseModal";
import { BasePromiseModal } from "@true-recall/obsidian/modals/shared/BasePromiseModal";
import { CustomStudyBody } from "@true-recall/obsidian/modals/study/custom-study/CustomStudyBody";
import type {
	CustomStudyModalResult,
	CustomStudyModalScope,
} from "@true-recall/obsidian/modals/study/custom-study/types";

export type { CustomStudyModalScope };

export class CustomStudyModal extends BasePromiseModal<CustomStudyModalResult> {
	private studyScope?: CustomStudyModalScope;

	constructor(
		app: App,
		options: BaseModalOptions,
		studyScope?: CustomStudyModalScope,
	) {
		super(app, options);
		this.studyScope = studyScope;
	}

	protected getDefaultResult(): CustomStudyModalResult {
		return { cancelled: true };
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<CustomStudyBody
				scopeLabel={this.studyScope?.scopeLabel}
				availableTags={this.studyScope?.availableTags}
				onResolve={(result) => {
					// Attach scope filters from the class-level studyScope
					if (result.sessionResult && this.studyScope) {
						result.sessionResult.sourceNoteFilters =
							this.studyScope.sourceNoteFilters;
						result.sessionResult.projectPath = this.studyScope.projectPath;
					}
					this.resolve(result);
				}}
			/>,
			container,
		);
	}
}
