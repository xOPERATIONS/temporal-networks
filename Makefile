.PHONY: all doc test build publish help

SHELL = /bin/sh

# target: all - build the project
all: build

# target: doc - create docs
doc:
	cargo doc --no-deps --document-private-items && cp -r target/doc/* docs/lib

# target: doc.open - open docs in a web browser
doc.open:
	cargo doc --no-deps --document-private-items --open

# target: test.rust - run tests against Rust code only
test.rust:
	cargo test && npx wasm-pack test --node

# target: test.js - run tests against WASM builds
test.js: build
	npm t

# target: test - test Rust, WASM, and JS
test: test.rust test.js

# target: build - build a JS agnostic package
build:
	npx wasm-pack build --scope xoperations --target nodejs --out-name index

# target: publish - publish to GitHub registry
publish: build
	wasm-pack publish --access=public

# target: help - display callable targets.
help:
	@egrep "^# target:" [Mm]akefile
