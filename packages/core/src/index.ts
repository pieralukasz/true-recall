// @true-recall/core — public API
//
// Sub-modules are available via deep imports:
//   @true-recall/core/flashcard
//   @true-recall/core/services
//   @true-recall/core/persistence
//   @true-recall/core/rag
//   @true-recall/core/integration
//   @true-recall/core/validation
//   @true-recall/core/utils
//   @true-recall/core/metrics

// Interfaces (platform adapters)
export type {
	IPersistence,
	IFrontmatter,
	IMetadataIndex,
	IFileSystem,
	INotification,
	IHttpClient,
} from "./interfaces";

// Types
export * from "./types";

// Errors
export * from "./errors";

// Constants
export * from "./constants";

// AI services
export * from "./ai";

// Events
export {
	type CardMutation,
	type CardChangeListener,
	notifyCardChange,
	onCardChange,
} from "./events";
