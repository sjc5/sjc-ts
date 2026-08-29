import { defineConfig } from "tsdown";
import { NPM_DIST_DIR } from "./src/unstable/tooling/index.ts";
import { baseTsdownConfig } from "./src/unstable/tooling/tsdown/config.ts";

export default defineConfig([
	{
		...baseTsdownConfig,
		entry: ["./src/unstable/ui/react/resizer/index.ts"],
		outDir: `${NPM_DIST_DIR}/unstable/ui/react/resizer`,
	},
	{
		...baseTsdownConfig,
		entry: [
			"./src/unstable/tooling/index.ts",
			"./src/unstable/tooling/oxfmt/config.ts",
			"./src/unstable/tooling/oxlint/config.ts",
			"./src/unstable/tooling/oxlint/plugin.ts",
		],
		outDir: `${NPM_DIST_DIR}/unstable/tooling`,
		deps: { ...baseTsdownConfig.deps, alwaysBundle: "@oxlint/plugins" },
	},
]);
