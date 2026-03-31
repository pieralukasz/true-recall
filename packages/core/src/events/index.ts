// Legacy re-exports for backward compatibility during migration.
// These will be removed once all consumers use DomainEventBus directly.
export {
	type CardChangeListener,
	type CardMutation,
	notifyCardChange,
	onCardChange,
} from "../events-legacy";
export { DomainEventBus } from "./event-bus";
export type {
	CardChanges,
	DomainEventMap,
	DomainEventType,
} from "./event-types";
