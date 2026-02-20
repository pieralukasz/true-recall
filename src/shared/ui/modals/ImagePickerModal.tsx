import { ImageService } from "@features/integration/services/ImageService";
import { BasePromiseModal } from "@shared/ui/modals/BasePromiseModal";
import { ImagePickerBody } from "@shared/ui/modals/image-picker/ImagePickerBody";
import type { App } from "obsidian";
import { render } from "preact";

export interface ImagePickerResult {
	cancelled: boolean;
	markdown: string;
}

interface ImagePickerModalOptions {
	currentFilePath: string;
}

export class ImagePickerModal extends BasePromiseModal<ImagePickerResult> {
	private options: ImagePickerModalOptions;
	private imageService: ImageService;
	private unmountBody?: () => void;

	constructor(app: App, options: ImagePickerModalOptions) {
		super(app, {
			title: "Insert Image",
			width: "550px",
		});
		this.options = options;
		this.imageService = new ImageService(app);
	}

	protected getDefaultResult(): ImagePickerResult {
		return { cancelled: true, markdown: "" };
	}

	onOpen(): void {
		super.onOpen();
		this.contentEl.addClass("true-recall-image-picker-modal");
	}

	protected renderBody(container: HTMLElement): void {
		render(
			<ImagePickerBody
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
