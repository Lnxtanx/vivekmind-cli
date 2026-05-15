/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Represents an option in the interactive selector
 */
interface Option<T> {
    value: T;
    label: string;
    description?: string;
}
/**
 * Interactive selector that allows users to navigate with arrow keys
 */
export declare class InteractiveSelector<T> {
    private options;
    private prompt;
    private selectedIndex;
    private isListening;
    constructor(options: Array<Option<T>>, prompt?: string);
    /**
     * Shows the interactive menu and waits for user selection
     */
    select(): Promise<T>;
    /**
     * Renders the menu to stdout
     */
    private renderMenu;
    /**
     * Calculates the total number of lines to clear
     */
    private calculateTotalLines;
    /**
     * Moves selection up
     */
    private moveUp;
    /**
     * Moves selection down
     */
    private moveDown;
}
export {};
