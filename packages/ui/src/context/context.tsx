/**
 * TrueRecallContext — platform-agnostic context for UI components.
 *
 * Components in @true-recall/ui never import from 'obsidian' directly.
 * Instead, the host platform (Obsidian, web, tests) provides an adapter
 * that implements this interface.
 */

export interface TrueRecallContext {
	/** Core service reference (typed loosely to avoid circular deps) */
	core: unknown;

	/** Navigation actions provided by the host */
	navigate: {
		openFile: (path: string) => void;
		startReview: (opts?: Record<string, unknown>) => void;
		openDashboard: () => void;
		openCardBrowser: (query?: Record<string, unknown>) => void;
		openModal: (request: Record<string, unknown>) => void;
	};

	/** Rendering primitives provided by the host */
	render: {
		/** Render markdown string into a container element */
		markdown: (md: string, container: HTMLElement) => void;
		/** Render an icon by id into a container element */
		icon: (container: HTMLElement, iconId: string) => void;
	};

	/** Platform information */
	platform: {
		isMobile: boolean;
	};
}
