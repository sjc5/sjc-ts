dist_dir := ".npm_dist"

nuke-node-modules:
	rm -rf node_modules 2>/dev/null || true
	find . -path "*/node_modules" -type d -exec rm -rf {} \; 2>/dev/null || true

nuke-npm-dist:
	rm -rf packages/*/$(dist_dir)

install:
	bun i

build:
	bun tsdown

test: build
	bun vitest run

check:
	bunx oxfmt --check
	bunx oxlint
	bunx tsc --noEmit

fix:
	bunx oxfmt
	bunx oxlint --fix
