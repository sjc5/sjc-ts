import type { OxfmtConfig } from "oxfmt";
import { BASE_IGNORE_PATTERNS } from "../shared.ts";

export const baseOxfmtConfig: OxfmtConfig = {
	ignorePatterns: BASE_IGNORE_PATTERNS,
	useTabs: true,
	tabWidth: 4,
	proseWrap: "always",
	printWidth: 80,
	sortImports: { newlinesBetween: false },
	sortPackageJson: false,
	overrides: [{ files: ["*.jsonc"], options: { trailingComma: "none" } }],
};
