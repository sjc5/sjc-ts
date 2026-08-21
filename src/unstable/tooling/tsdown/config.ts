import { type UserConfig } from "tsdown";

export const baseTsdownConfig: UserConfig = {
	format: "esm",
	deps: { neverBundle: true },
	sourcemap: true,
	dts: { sourcemap: true },
	platform: "neutral",
};
