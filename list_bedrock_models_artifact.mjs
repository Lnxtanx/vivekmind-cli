import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import * as fs from 'fs';
import * as path from 'path';

// Simple .env parser to get credentials
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || 'us-east-1';

if (!accessKeyId || !secretAccessKey) {
  console.error('Missing AWS credentials in .env file!');
  process.exit(1);
}

const artifactPath = 'C:\\Users\\vivek\\.gemini\\antigravity\\brain\\c06275c1-3bf7-4643-bc00-c0648de3d0bb\\bedrock_models_list.md';
let output = '# Available AWS Bedrock Models\n\n';
output += `**Region:** ${region}\n\n`;

async function listModels() {
  const client = new BedrockClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  try {
    const command = new ListFoundationModelsCommand({});
    const response = await client.send(command);
    
    const activeModels = response.modelSummaries?.filter(m => m.modelLifecycle?.status === 'ACTIVE') || [];
    output += `Found **${activeModels.length}** active models:\n\n`;
    
    // Group by provider
    const byProvider = {};
    activeModels.forEach(m => {
      const provider = m.providerName || 'Unknown';
      if (!byProvider[provider]) byProvider[provider] = [];
      byProvider[provider].push({
        id: m.modelId,
        name: m.modelName,
        onDemand: m.inferenceTypesSupported?.includes('ON_DEMAND')
      });
    });

    for (const [provider, models] of Object.entries(byProvider)) {
      output += `## ${provider}\n\n`;
      output += `| Model ID | Model Name | Supports On-Demand |\n`;
      output += `|---|---|---|\n`;
      models.forEach(m => {
        output += `| \`${m.id}\` | ${m.name} | ${m.onDemand ? '✅' : '❌'} |\n`;
      });
      output += '\n';
    }

    fs.writeFileSync(artifactPath, output, 'utf8');
    console.log('Successfully wrote models to artifact:', artifactPath);
  } catch (error) {
    console.error('Error fetching models:', error);
  }
}

listModels();
