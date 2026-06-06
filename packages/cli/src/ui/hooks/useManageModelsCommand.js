/**
 * @license
 * Copyright 2025 VivekMind
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useState } from 'react';
export function useManageModelsCommand() {
    const [isManageModelsDialogOpen, setIsManageModelsDialogOpen] = useState(false);
    const openManageModelsDialog = useCallback(() => {
        setIsManageModelsDialogOpen(true);
    }, []);
    const closeManageModelsDialog = useCallback(() => {
        setIsManageModelsDialogOpen(false);
    }, []);
    return {
        isManageModelsDialogOpen,
        openManageModelsDialog,
        closeManageModelsDialog,
    };
}
//# sourceMappingURL=useManageModelsCommand.js.map