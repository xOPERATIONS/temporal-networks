.PHONY: all doc test build publish help

# target: all - build the project
all: build

# target: doc - create docs
doc:
	cargo doc --no-deps --target-dir docs

# target: test - run tests
test:
	cargo test && wasm-pack test --node

# target: build - build a JS agnostic package
build:
	wasm-pack build

# target: publish - publish to GitHub registry
publish:
	wasm-pack publish

# target: help - display callable targets.
help:
	@egrep "^# target:" [Mm]akefile
