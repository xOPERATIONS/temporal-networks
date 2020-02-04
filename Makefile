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
	cargo test && wasm-pack test --node

# target: test - test Rust, WASM, and JS
test: test.rust

# target: build - build a JS agnostic package
build:
	wasm-pack build

# target: publish - publish to GitHub registry
publish: doc
	wasm-pack publish

# target: help - display callable targets.
help:
	@egrep "^# target:" [Mm]akefile
