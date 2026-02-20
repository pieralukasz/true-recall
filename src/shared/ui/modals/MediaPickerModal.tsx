import { ImageService } from "@features/integration/services/ImageService";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import {
	MediaPickerBody,
	type MediaPickerResult,
} from "@shared/ui/modals/media-picker/MediaPickerBody";
import type { App } from "obsidian";
import { render } from "preact";

export type { MediaPickerResult } from "@shared/ui/modals/media-picker/MediaPickerBody";

interface MediaPickerModalOptions {
	currentFilePath: string;
}

export class MediaPickerModal extends BasePromiseModal<MediaPickerResult> {
	private options: MediaPickerModalOptions;
	private imageService: ImageService;
	private unmountBody?: () => void;

	constructor(app: App, options: MediaPickerModalOptions) {
		super(app, {
			title: "Insert Media",
			width: "550px",
		});
		this.options = options;
		this.imageService = new ImageService(app);
	}

	protected getDefaultResult(): MediaPickerResult {
		return { cancelled: true, markdown: "" };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-media-picker-modal");
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<MediaPickerBody
				app={this.app}
				imageService={this.imageService}
				currentFilePath={this.options.currentFilePath}
				onResolve={(result) => this.resolve(result)}
				onClose={() => this.close()}
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
