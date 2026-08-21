.PHONY: nuke install build test check fix

repo_dir := $(dir $(abspath $(firstword $(MAKEFILE_LIST))))
dist_dir := .npm_dist

nuke: export NUKE_DIR := $(dirname)
nuke:
	@case "$$NUKE_DIR" in ""|"."|".."|*/*) echo "invalid dirname: $$NUKE_DIR"; exit 2;; esac
	find "$(repo_dir)" -type d -name "$$NUKE_DIR" -prune -exec rm -rf -- {} +

nuke-node-modules:
	$(MAKE) nuke dirname=node_modules

nuke-npm-dist:
	$(MAKE) nuke dirname=$(dist_dir)

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

npm-auth:
	@npm whoami >/dev/null 2>&1 || npm login

publish-step-one:
	@test -n "$(version)" || (echo "version is required"; exit 2)
	$(MAKE) npm-auth
	$(MAKE) check
	$(MAKE) test
	bun pm version $(version)
	bun pm pack --dry-run

# make publish-pre version=whatever
publish-pre:
	$(MAKE) publish-step-one version=$(version)
	npm publish --access public --tag pre
	git push --follow-tags

# make dangerous-publish-non-pre version=whatever
dangerous-publish-non-pre:
	$(MAKE) publish-step-one version=$(version)
	npm publish --access public
	git push --follow-tags
