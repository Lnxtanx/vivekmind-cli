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

async function listModels() {
  const client = new BedrockClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });

  try {
    console.log(`Fetching models for region: ${region}...`);
    const command = new ListFoundationModelsCommand({});
    const response = await client.send(command);
    
    const activeModels = response.modelSummaries?.filter(m => m.modelLifecycle?.status === 'ACTIVE') || [];
    
    console.log(`\nFound ${activeModels.length} active models:\n`);
    
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
      console.log(`=== ${provider} ===`);
      models.forEach(m => {
        console.log(`- ID: ${m.id}`);
        console.log(`  Name: ${m.name}`);
        console.log(`  On-Demand Supported: ${m.onDemand ? 'Yes' : 'No'}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('Error fetching models:', error);
  }
}

listModels();
