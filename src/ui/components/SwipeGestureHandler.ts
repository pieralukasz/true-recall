/**
 * Configuration for swipe gesture detection
 */
interface SwipeConfig {
    /** Minimum pixels for a valid swipe */
    minSwipeDistance: number;
    /** Maximum milliseconds for a swipe gesture */
    maxSwipeTime: number;
}

/**
 * Handlers for swipe gesture events
 */
export interface SwipeHandlers {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onTap?: () => void;
}

/**
 * Touch gesture handler for mobile flashcard review
 * Supports swipe gestures (left/right/up/down) and tap detection
 */
export class SwipeGestureHandler {
    private container: HTMLElement;
    private startX: number = 0;
    private startY: number = 0;
    private startTime: number = 0;
    private config: SwipeConfig;
    private handlers: SwipeHandlers = {};

    private boundHandleTouchStart: (e: TouchEvent) => void;
    private boundHandleTouchEnd: (e: TouchEvent) => void;

    constructor(container: HTMLElement, config?: Partial<SwipeConfig>) {
        this.container = container;
        this.config = {
            minSwipeDistance: 80,
            maxSwipeTime: 500,
            ...config
        };

        // Bind handlers for proper cleanup
        this.boundHandleTouchStart = this.handleTouchStart.bind(this);
        this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);

        this.bindEvents();
    }

    /**
     * Set or update gesture handlers
     */
    setHandlers(handlers: SwipeHandlers): void {
        this.handlers = handlers;
    }

    /**
     * Bind touch event listeners
     */
    private bindEvents(): void {
        this.container.addEventListener('touchstart', this.boundHandleTouchStart, { passive: true });
        this.container.addEventListener('touchend', this.boundHandleTouchEnd, { passive: true });
    }

    /**
     * Handle touch start event - record starting position and time
     */
    private handleTouchStart(e: TouchEvent): void {
        const touch = e.touches[0];
        if (!touch) return;

        this.startX = touch.clientX;
        this.startY = touch.clientY;
        this.startTime = Date.now();
    }

    /**
     * Handle touch end event - determine gesture type and trigger handler
     */
    private handleTouchEnd(e: TouchEvent): void {
        const touch = e.changedTouches[0];
        if (!touch) return;

        const deltaX = touch.clientX - this.startX;
        const deltaY = touch.clientY - this.startY;
        const deltaTime = Date.now() - this.startTime;

        // Check if gesture was too slow
        if (deltaTime > this.config.maxSwipeTime) {
            return;
        }

        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Horizontal swipe detection (prioritize if X movement > Y movement)
        if (absX > this.config.minSwipeDistance && absX > absY) {
            if (deltaX > 0) {
                this.handlers.onSwipeRight?.();
            } else {
                this.handlers.onSwipeLeft?.();
            }
            return;
        }

        // Vertical swipe detection
        if (absY > this.config.minSwipeDistance && absY > absX) {
            if (deltaY < 0) {
                this.handlers.onSwipeUp?.();
            } else {
                this.handlers.onSwipeDown?.();
            }
            return;
        }

        // Tap detection (minimal movement)
        if (absX < 20 && absY < 20) {
            this.handlers.onTap?.();
        }
    }

    /**
     * Clean up event listeners
     */
    destroy(): void {
        this.container.removeEventListener('touchstart', this.boundHandleTouchStart);
        this.container.removeEventListener('touchend', this.boundHandleTouchEnd);
    }
}
