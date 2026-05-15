/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { type Config } from '@vivekmind/core';
import { type ManageModelsCatalogEntry } from '../manageModels/manageModels.js';
interface ManageModelsDialogProps {
    config: Config;
    onClose: () => void;
}
type FocusMode = 'tabs' | 'search' | 'list';
export type FilterMode = 'all' | 'enabled' | 'free' | 'vision';
declare const MANAGE_MODELS_TABS: readonly [{
    readonly source: "openrouter";
    readonly label: "OpenRouter";
    readonly enabled: true;
}, {
    readonly source: "modelstudio";
    readonly label: "ModelStudio";
    readonly enabled: false;
}];
type ManageModelsTabSource = (typeof MANAGE_MODELS_TABS)[number]['source'];
export declare function buildModelLabel(entry: ManageModelsCatalogEntry): string;
export declare function applyCatalogFilters(params: {
    entries: ManageModelsCatalogEntry[];
    query: string;
    selectedIds: string[];
    filterMode: FilterMode;
}): ManageModelsCatalogEntry[];
export declare function getNextFocusMode(current: FocusMode, direction: 'forward' | 'backward', hasList: boolean): FocusMode;
export declare function getNextEnabledTabSource(current: ManageModelsTabSource, direction: 'left' | 'right'): ManageModelsTabSource;
export declare function ManageModelsDialog({ config, onClose, }: ManageModelsDialogProps): React.JSX.Element;
export {};
