import type { App } from "obsidian";
import { render } from "preact";
import type { BaseModalOptions } from "@shared/ui/modals/BaseModal";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import { CustomStudyBody } from "@features/study/modals/custom-study/CustomStudyBody";
import type {
	CustomStudyModalResult,
	CustomStudyModalScope,
} from "@features/study/modals/custom-study/types";

export type { CustomStudyModalResult, CustomStudyModalScope };

export class CustomStudyModal extends BasePromiseModal<CustomStudyModalResult> {
	private studyScope?: CustomStudyModalScope;
	private unmountBody?: () => void;

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
				onResolve={(result) => {
					// Attach scope filters from the class-level studyScope
					if (result.sessionResult && this.studyScope) {
						result.sessionResult.projectFilters =
							this.studyScope.projectFilters;
						result.sessionResult.sourceNoteFilters =
							this.studyScope.sourceNoteFilters;
					}
					this.resolve(result);
				}}
			/>,
			container,
		);
		this.unmountBody = () => render(null, container);
	}

	onClose(): void {
		this.unmountBody?.();
		super.onClose();
	}
}
