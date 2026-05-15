import { Storage } from '../config/storage.js';
import path from 'node:path';
import * as os from 'node:os';
import { EXTENSION_SETTINGS_FILENAME, EXTENSIONS_CONFIG_FILENAME, } from './variables.js';
import * as fs from 'node:fs';
export class ExtensionStorage {
    extensionName;
    constructor(extensionName) {
        this.extensionName = extensionName;
    }
    getExtensionDir() {
        return path.join(ExtensionStorage.getUserExtensionsDir(), this.extensionName);
    }
    getConfigPath() {
        return path.join(this.getExtensionDir(), EXTENSIONS_CONFIG_FILENAME);
    }
    getEnvFilePath() {
        return path.join(this.getExtensionDir(), EXTENSION_SETTINGS_FILENAME);
    }
    static getUserExtensionsDir() {
        const homeDir = os.homedir();
        // Fallback for test environments where os.homedir might be mocked to return undefined
        if (!homeDir) {
            const tmpDir = os.tmpdir();
            if (!tmpDir) {
                // Ultimate fallback when both os.homedir and os.tmpdir are mocked
                return '/tmp/.vivekmind/extensions';
            }
            return path.join(tmpDir, '.vivekmind', 'extensions');
        }
        const storage = new Storage(homeDir);
        return storage.getExtensionsDir();
    }
    static async createTmpDir() {
        return await fs.promises.mkdtemp(path.join(os.tmpdir(), 'qwen-extension'));
    }
}
//# sourceMappingURL=storage.js.map