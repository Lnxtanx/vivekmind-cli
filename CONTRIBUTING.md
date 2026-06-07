# Contributing to VivekMind

Thank you for contributing to VivekMind CLI. This project is licensed under the Apache-2.0 license.

## Legal Requirements

- Do not remove existing copyright notices.
- Do not remove SPDX license identifiers.
- If you substantially modify a file that already contains an upstream copyright notice, keep the original notice and add:

```text
Modifications Copyright (C) 2026 VivekMind
```

- For new files created for VivekMind, use:

```text
Copyright (C) 2026 VivekMind
SPDX-License-Identifier: Apache-2.0
```

## Development

Install dependencies and run the standard checks before submitting changes:

```bash
npm install
npm run build
npm run typecheck
npm test
```

Keep provider names, model names, and upstream attribution accurate. References to external models and OAuth providers should not be renamed as part of product-branding cleanup.

