/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { createContext, useContext } from 'react';
const CompactModeContext = createContext({
    compactMode: false,
});
export const useCompactMode = () => useContext(CompactModeContext);
export const CompactModeProvider = CompactModeContext.Provider;
//# sourceMappingURL=CompactModeContext.js.map