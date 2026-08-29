import { definePlugin } from "@oxlint/plugins";
import * as convertibleNamingConvention from "./rules/convertible-naming-convention.ts";
import * as noCommonBooleanFunctionPrefixes from "./rules/no-common-boolean-function-prefixes.ts";
import * as noComplexImplicitReturn from "./rules/no-complex-implicit-return.ts";

export const PLUGIN_NAME = "sjc-ts";

export default definePlugin({
	meta: { name: PLUGIN_NAME },
	rules: {
		[convertibleNamingConvention.RULE_NAME]:
			convertibleNamingConvention.rule,
		[noComplexImplicitReturn.RULE_NAME]: noComplexImplicitReturn.rule,
		[noCommonBooleanFunctionPrefixes.RULE_NAME]:
			noCommonBooleanFunctionPrefixes.rule,
	},
});
