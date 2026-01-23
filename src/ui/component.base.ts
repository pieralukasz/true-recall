/**
 * Base Component Types and Utilities
 * Provides common interface for UI components
 */
import type { App, Component } from "obsidian";
import { EventRegistry, createEventRegistry } from "../utils/event.utils";

/**
 * Base interface for component handlers
 */
export interface ComponentHandlers {
    app: App;
    component: Component;
}

/**
 * Base abstract class for UI components
 * Provides lifecycle management and event cleanup
 */
export abstract class BaseComponent {
    protected container: HTMLElement;
    protected element: HTMLElement | null = null;
    protected events: EventRegistry;

    constructor(container: HTMLElement) {
        this.container = container;
        this.events = createEventRegistry();
    }

    /**
     * Render the component
     * Should be implemented by subclasses
     */
    abstract render(): void;

    /**
     * Update the component with new data
     * Override in subclasses if needed
     */
    update(_data: unknown): void {
        this.render();
    }

    /**
     * Destroy the component and cleanup resources
     */
    destroy(): void {
        this.events.cleanup();
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
    }

    /**
     * Show the component
     */
    show(): void {
        if (this.element) {
            this.element.style.display = "";
        }
    }

    /**
     * Hide the component
     */
    hide(): void {
        if (this.element) {
            this.element.style.display = "none";
        }
    }

    /**
     * Check if component is visible
     */
    isVisible(): boolean {
        return this.element?.style.display !== "none";
    }

    /**
     * Get the component's root element
     */
    getElement(): HTMLElement | null {
        return this.element;
    }
}

/**
 * Component factory type
 */
export type ComponentFactory<T extends BaseComponent, P = unknown> = (
    container: HTMLElement,
    props: P
) => T;
