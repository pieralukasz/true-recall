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

// AI services
export * from "./ai";
// Constants
export * from "./constants";

// Errors
export * from "./errors";
// Events
export {
	type CardChangeListener,
	type CardMutation,
	notifyCardChange,
	onCardChange,
} from "./events";
// Interfaces (platform adapters)
export type {
	IFileSystem,
	IFrontmatter,
	IHttpClient,
	ILinkResolver,
	IMetadataIndex,
	INotification,
	IPersistence,
	ISettingsPersistence,
	IUidRemovalPrompt,
	IVaultEventBridge,
	UidChangeEvent,
	UidRemovalAction,
} from "./interfaces";
// Types
export * from "./types";
