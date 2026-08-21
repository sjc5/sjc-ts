import { definePlugin } from "@oxlint/plugins";
import * as noComplexImplicitReturn from "./rules/no-complex-implicit-return.ts";

export const PLUGIN_NAME = "sjc-ts";

export default definePlugin({
	meta: { name: PLUGIN_NAME },
	rules: {
		[noComplexImplicitReturn.RULE_NAME]: noComplexImplicitReturn.rule,
	},
});
