import fs from 'fs';
import path from 'path';

const replacements = [
  { old: /respectQwenIgnore/g, new: 'respectVivekMindIgnore' },
  { old: /shouldQwenIgnoreFile/g, new: 'shouldVivekMindIgnoreFile' },
  { old: /getFileFilteringRespectQwenIgnore/g, new: 'getFileFilteringRespectVivekMindIgnore' },
  { old: /QwenIgnoreFilter/g, new: 'VivekMindIgnoreFilter' },
  { old: /QwenIgnoreParser/g, new: 'VivekMindIgnoreParser' },
  { old: /qwenIgnoreFilter/g, new: 'vivekMindIgnoreFilter' },
  { old: /qwenIgnoredCount/g, new: 'vivekMindIgnoredCount' },
  { old: /qwen-ignored/g, new: 'vivekmind-ignored' },
  { old: /qwen-ignore/g, new: 'vivekmind-ignore' },
  { old: /qwenignore/g, new: 'vivekmindignore' },
  { old: /VivekMind-ignored/g, new: 'VivekMind-ignored' },
  { old: /useQwenignore/g, new: 'useVivekMindIgnore' },
  { old: /qwenIgnoreCache/g, new: 'vivekMindIgnoreCache' },
  { old: /qwenIgnorePath/g, new: 'vivekMindIgnorePath' },
  { old: /qwenIgnored/g, new: 'vivekMindIgnored' },
  { old: /qwenIgnore/g, new: 'vivekMindIgnore' },
  { old: /QwenIgnore/g, new: 'VivekMindIgnore' },
  { old: /qwen-ignored/g, new: 'vivekmind-ignored' },
  { old: /qwen_ignore/g, new: 'vivekmind_ignore' },
  { old: /qwen_ignored/g, new: 'vivekmind_ignored' },
  { old: /'qwen'/g, new: "'vivekmind'" },
  { old: /"qwen"/g, new: '"vivekmind"' },
  // Import path change
  { old: /qwenIgnoreParser\.js/g, new: 'vivekMindIgnoreParser.js' },
  { old: /qwenIgnoreParser/g, new: 'vivekMindIgnoreParser' }
];

const files = [
  'packages/cli/src/config/config.test.ts',
  'packages/cli/src/config/settingsSchema.test.ts',
  'packages/cli/src/config/settingsSchema.ts',
  'packages/cli/src/ui/components/SettingsDialog.test.tsx',
  'packages/cli/src/ui/hooks/atCommandProcessor.test.ts',
  'packages/cli/src/ui/hooks/atCommandProcessor.ts',
  'packages/cli/src/ui/hooks/useAtCompletion.test.ts',
  'packages/cli/src/ui/hooks/useAtCompletion.ts',
  'packages/cli/src/utils/settingsUtils.ts',
  'packages/core/src/config/config.ts',
  'packages/core/src/config/constants.ts',
  'packages/core/src/services/fileDiscoveryService.test.ts',
  'packages/core/src/services/fileDiscoveryService.ts',
  'packages/core/src/tools/glob.test.ts',
  'packages/core/src/tools/glob.ts',
  'packages/core/src/tools/ls.test.ts',
  'packages/core/src/tools/ls.ts',
  'packages/core/src/tools/ripGrep.test.ts',
  'packages/core/src/tools/ripGrep.ts',
  'packages/core/src/utils/getFolderStructure.test.ts',
  'packages/core/src/utils/getFolderStructure.ts',
  'packages/core/src/utils/pathReader.test.ts',
  'packages/core/src/utils/pathReader.ts',
  'packages/core/src/utils/readManyFiles.test.ts',
  'packages/vscode-ide-companion/schemas/settings.schema.json',
  'packages/core/src/utils/vivekMindIgnoreParser.ts',
  'packages/core/src/utils/vivekMindIgnoreParser.test.ts',
  'packages/core/src/services/fileReadCache.integration.test.ts',
  'packages/core/src/tools/read-file.ts',
  'packages/core/src/utils/filesearch/crawler.test.ts',
  'packages/core/src/utils/filesearch/fileSearch.ts',
  'packages/core/src/utils/filesearch/fileSearch.test.ts',
  'packages/core/src/utils/filesearch/ignore.ts',
  'packages/core/src/utils/filesearch/ignore.test.ts'
];

files.forEach(file => {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    replacements.forEach(r => {
      if (r.old.test(content)) {
        content = content.replace(r.old, r.new);
        changed = true;
      }
    });
    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  } else {
    console.warn(`File not found: ${file}`);
  }
});
