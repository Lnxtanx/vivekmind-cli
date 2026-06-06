/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { handleVivekMindAuth, handleApiKeyAuth, runInteractiveAuth, showAuthStatus, } from './auth/handler.js';
import { t } from '../i18n/index.js';
// Define subcommands separately
const vivekmindOauthCommand = {
    command: 'vivekmind-oauth',
    describe: t('Authenticate using VivekMind OAuth'),
    handler: async () => {
        await handleVivekMindAuth('vivekmind-oauth', {});
    },
};
const codePlanCommand = {
    command: 'coding-plan',
    describe: t('Authenticate using Alibaba Cloud Coding Plan'),
    builder: (yargs) => yargs
        .option('region', {
        alias: 'r',
        describe: t('Region for Coding Plan (china/global)'),
        type: 'string',
    })
        .option('key', {
        alias: 'k',
        describe: t('API key for Coding Plan'),
        type: 'string',
    }),
    handler: async (argv) => {
        const region = argv['region'];
        const key = argv['key'];
        // If region and key are provided, use them directly
        if (region && key) {
            await handleVivekMindAuth('coding-plan', { region, key });
        }
        else {
            // Otherwise, prompt interactively
            await handleVivekMindAuth('coding-plan', {});
        }
    },
};
const apiKeyCommand = {
    command: 'api-key',
    describe: t('Authenticate using an API key'),
    handler: async () => {
        await handleApiKeyAuth();
    },
};
const openRouterCommand = {
    command: 'openrouter',
    describe: t('Authenticate using OpenRouter API key setup'),
    builder: (yargs) => yargs.option('key', {
        alias: 'k',
        describe: t('API key for OpenRouter'),
        type: 'string',
    }),
    handler: async (argv) => {
        const key = argv['key'];
        await handleVivekMindAuth('openrouter', { key });
    },
};
const statusCommand = {
    command: 'status',
    describe: t('Show current authentication status'),
    handler: async () => {
        await showAuthStatus();
    },
};
export const authCommand = {
    command: 'auth',
    describe: t('Configure VivekMind authentication with OpenRouter, Coding Plan, API Key, or VivekMind-OAuth'),
    builder: (yargs) => yargs
        .command(vivekmindOauthCommand)
        .command(codePlanCommand)
        .command(openRouterCommand)
        .command(apiKeyCommand)
        .command(statusCommand)
        .demandCommand(0) // Don't require a subcommand
        .version(false),
    handler: async () => {
        // This handler is for when no subcommand is provided - show interactive menu
        await runInteractiveAuth();
    },
};
//# sourceMappingURL=auth.js.map