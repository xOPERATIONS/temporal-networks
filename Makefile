.PHONY: all build doc test install publish help

SHELL = /bin/sh

# target: all - build the project
all: build

# target: build - build a JS agnostic package
build:
	npx wasm-pack build --scope xoperations --target nodejs --out-name index

# target: doc - create docs
doc: build
	cargo doc --no-deps --lib && cp -r target/doc/* docs/rust
	npx typedoc pkg --includeDeclarations --excludeExternals --out docs/js

# target: doc.open - open docs in a web browser
doc.open:
	cargo doc --no-deps --open

# target: lint - lint Rust and JS
lint: lint.rs lint.js

# target: lint.rs - lint Rust
lint.rs:
	cargo clippy

# target: lint.js - lint JS
lint.js:
	npx prettier test/**/*.js --check

# target: test.rs - run tests against Rust
test.rs: test.rust test.wasm

# target: test.rust - run tests against pure Rust
test.rust:
	cargo test

# target: test.wasm - run tests against wasm Rust
test.wasm:
	 npx wasm-pack test --node

# target: test.js - run tests against wasm builds from the JS side
test.js: build
	npm t

# target: test - test Rust, wasm, and JS
test: test.rs test.js

# target: publish - publish to NPM. Requires being logged into NPM
publish: build
	npx wasm-pack publish --access=public

# target: help - display callable targets.
help:
	@egrep "^# target:" [Mm]akefile
