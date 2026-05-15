import fs from 'fs';
import path from 'path';

const replacements = [
  { old: /AuthType\.VIVEKMIND_OAUTH/g, new: 'AuthType.VIVEKMIND_OAUTH' },
  { old: /"vivekmind-oauth"/g, new: '"vivekmind-oauth"' },
  { old: /VIVEKMIND_CUSTOM_API_KEY/g, new: 'VIVEKMIND_CUSTOM_API_KEY' },
  { old: /QwenCredentials/g, new: 'VivekMindCredentials' },
  { old: /IQwenOAuth2Client/g, new: 'IVivekMindOAuth2Client' },
  { old: /QwenOAuth2Client/g, new: 'VivekMindOAuth2Client' },
  { old: /QwenOAuth2Event/g, new: 'VivekMindOAuth2Event' },
  { old: /qwenOAuth2Events/g, new: 'vivekmindOAuth2Events' },
  { old: /getQwenOAuthClient/g, new: 'getVivekMindOAuthClient' },
  { old: /authWithQwenDeviceFlow/g, new: 'authWithVivekMindDeviceFlow' },
  { old: /cacheQwenCredentials/g, new: 'cacheVivekMindCredentials' },
  { old: /clearQwenCredentials/g, new: 'clearVivekMindCredentials' },
  { old: /getQwenCachedCredentialPath/g, new: 'getVivekMindCachedCredentialPath' },
  { old: /qwenAuthState/g, new: 'vivekmindAuthState' },
  { old: /QwenContentGenerator/g, new: 'VivekMindContentGenerator' },
  { old: /\.\/qwenOAuth2\.js/g, new: './vivekmindOAuth2.js' },
  { old: /\.\/qwenContentGenerator\.js/g, new: './vivekmindContentGenerator.js' }
];

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

const targetDirs = [
  path.resolve('packages/core/src'),
  path.resolve('packages/cli/src')
];

let totalFiles = 0;
let modifiedFiles = 0;

targetDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`);
    return;
  }
  walk(dir, (filePath) => {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      totalFiles++;
      let content = fs.readFileSync(filePath, 'utf8');
      let originalContent = content;
      
      replacements.forEach(r => {
        content = content.replace(r.old, r.new);
      });
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        modifiedFiles++;
        console.log(`Modified: ${filePath}`);
      }
    }
  });
});

console.log(`Total files scanned: ${totalFiles}`);
console.log(`Modified files: ${modifiedFiles}`);
