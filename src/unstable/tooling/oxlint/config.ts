import type { OxlintConfig } from "oxlint";
import { BASE_IGNORE_PATTERNS } from "../shared.ts";
import plugin, { PLUGIN_NAME } from "./plugin.ts";

export const baseOxlintConfig: OxlintConfig = {
	ignorePatterns: BASE_IGNORE_PATTERNS,
	jsPlugins: ["sjc-ts/unstable/tooling/oxlint/plugin"],
	rules: {
		...Object.fromEntries(
			Object.keys(plugin.rules).map((name): [string, "error"] => {
				return [`${PLUGIN_NAME}/${name}`, "error"];
			}),
		),
		curly: "error",
		"typescript/array-type": ["error", { default: "generic" }],
	},
	options: {
		typeAware: true,
	},
};
