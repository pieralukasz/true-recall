/**
 * BaseComponent - Shared base class for browser components
 *
 * Provides a consistent pattern for components with:
 * - Incremental update() instead of full re-render
 * - Lifecycle management (render, update, destroy)
 * - Props and callbacks separation
 */

/**
 * Base class for browser components
 *
 * @template TProps - Component props type (must be an object)
 * @template TCallbacks - Component callbacks type
 */
export abstract class BaseComponent<TProps extends object, TCallbacks = Record<string, never>> {
    protected container: HTMLElement;
    protected props: TProps;
    protected callbacks: TCallbacks;
    protected isRendered = false;

    constructor(container: HTMLElement, props: TProps, callbacks: TCallbacks) {
        this.container = container;
        this.props = props;
        this.callbacks = callbacks;
    }

    /**
     * Initial render - creates DOM structure
     * Should only be called once
     */
    abstract render(): void;

    /**
     * Update with new props
     * Uses incremental updates for performance
     */
    update(props: Partial<TProps>): void {
        // Track what changed
        const changedKeys = Object.keys(props) as (keyof TProps)[];
        const hasChanges = changedKeys.some(key => this.props[key] !== props[key]);

        if (!hasChanges) return;

        // Apply changes
        Object.assign(this.props, props);

        // Perform incremental update if rendered
        if (this.isRendered) {
            this.onUpdate(changedKeys);
        }
    }

    /**
     * Handle incremental updates
     * Override to implement efficient partial re-renders
     */
    protected abstract onUpdate(changedKeys: (keyof TProps)[]): void;

    /**
     * Clean up resources
     */
    destroy(): void {
        this.container.empty();
        this.isRendered = false;
    }
}
