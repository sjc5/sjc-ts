# New Repo Setup

```sh
git init
mkdir -p .vscode
touch .gitignore \
	package.json \
	tsconfig.json \
	oxfmt.config.ts \
	oxlint.config.ts \
	.vscode/extensions.json \
	.vscode/settings.example.jsonc
```

`.gitignore`:

```gitignore
.DS_Store

.vscode/*
!.vscode/extensions.json
!.vscode/settings.example.jsonc

*.local
*.local.*

.env
.env.*
!.env.example

node_modules/
```

`oxfmt.config.ts`:

```ts
import { defineConfig } from "oxfmt";
import { baseOxfmtConfig } from "sjc-ts/unstable/tooling/oxfmt";

export default defineConfig(baseOxfmtConfig);
```

`oxlint.config.ts`:

```ts
import { defineConfig } from "oxlint";
import { baseOxlintConfig } from "sjc-ts/unstable/tooling/oxlint";

export default defineConfig({ extends: [baseOxlintConfig] });
```

`package.json`:

```json
{
	"type": "module",
	"private": true,
	"dependencies": {},
	"devDependencies": {}
}
```

`tsconfig.json`:

```json
{
	"extends": "sjc-ts/unstable/tooling/tsconfig.base.json"
}
```

`.vscode/extensions.json`:

```json
{
	"recommendations": ["oxc.oxc-vscode"]
}
```

`.vscode/settings.example.jsonc`:

```jsonc
{
	"search.exclude": { "**/node_modules": true },
	"editor.formatOnSave": true,
	"editor.tabSize": 4,
	"oxc.fmt.configPath": "oxfmt.config.ts",
	"[markdown][html][css][typescript][typescriptreact][json][jsonc][toml][yaml]": {
		"editor.defaultFormatter": "oxc.oxc-vscode",
		"editor.codeActionsOnSave": {
			"source.fixAll.oxc": "always",
		},
	},
	"js/ts.preferences.importModuleSpecifierEnding": "js",
}
```

Run:

```sh
bun add -D typescript sjc-ts oxfmt oxlint oxlint-tsgolint
cp .vscode/settings.example.jsonc .vscode/settings.json
bun oxfmt
```
