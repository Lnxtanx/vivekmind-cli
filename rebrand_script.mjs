import fs from 'fs';
import path from 'path';

const replacements = [
  { old: /Qwen OAuth/g, new: 'VivekMind OAuth' },
  { old: /qwen-oauth/g, new: 'vivekmind-oauth' },
  { old: /Qwen Code/g, new: 'VivekMind' },
  { old: /Qwen Team/g, new: 'VivekMind Team' },
  { old: /handleQwenAuth/g, new: 'handleVivekMindAuth' },
  { old: /QwenAuthOptions/g, new: 'VivekMindAuthOptions' },
  { old: /getGlobalQwenDir/g, new: 'getGlobalVivekMindDir' },
  { old: /getQwenDir/g, new: 'getVivekMindDir' },
  { old: /qwen-extension\.json/g, new: 'vivekmind-extension.json' },
  { old: /QwenAgent/g, new: 'VivekMindAgent' },
  { old: /qwenOAuthMethods/g, new: 'vivekmindOAuthMethods' },
  { old: /handleQwenOAuth/g, new: 'handleVivekMindOAuth' },
  { old: /QWEN_DIR/g, new: 'VIVEKMIND_DIR' },
  { old: /QWEN_/g, new: 'VIVEKMIND_' },
  // Generic Qwen to VivekMind, but be careful not to match qwen- (model prefix)
  // We'll use a word boundary or specific patterns.
  { old: /\bQwen\b/g, new: 'VivekMind' },
];

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f === 'node_modules' || f === '.git' || f === 'dist') continue;
      walk(dirPath, callback);
    } else {
      callback(path.join(dir, f));
    }
  }
}

const targetDir = process.cwd();

walk(targetDir, (filePath) => {
  if (
    filePath.endsWith('.ts') ||
    filePath.endsWith('.tsx') ||
    filePath.endsWith('.js') ||
    filePath.endsWith('.mjs') ||
    filePath.endsWith('.json') ||
    filePath.endsWith('.md') ||
    filePath.endsWith('.bat') ||
    filePath.endsWith('.sh')
  ) {
    if (filePath.includes('node_modules') || filePath.includes('.git') || filePath.includes('dist')) return;
    
    // Skip the script itself
    if (filePath === path.join(targetDir, 'rebrand_script.mjs')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    replacements.forEach(r => {
      content = content.replace(r.old, r.new);
    });

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated: ${filePath}`);
    }
  }
});
