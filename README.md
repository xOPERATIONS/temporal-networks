# Temporal Networks

Implements Simple Temporal Networks in Rust and compiles to WASM for use in any JS project.

[Library documentation](https://xoperations.github.io/temporal-networks/lib/stn/)

[![npm version](https://img.shields.io/npm/v/@xoperations/temporal-networks.svg?style=flat)](https://npmjs.org/package/@xoperations/temporal-networks "View this project on npm")

## What is a Simple Temporal Network?

* See [here](https://github.com/xOPERATIONS/temporal-networks/blob/master/docs/references/STNs_for_EVAs.pdf) for a tutorial
* There are additional papers in [docs/references](https://github.com/xOPERATIONS/temporal-networks/blob/master/docs/references/)

## End User Installation

```sh
npm i @xoperations/temporal-networks
```

## Usage

TBD

## Development

### Dependencies

1. [Install rust/cargo](https://doc.rust-lang.org/cargo/getting-started/installation.html)
2. [Install Node](https://nodejs.org/en/download/) (we recommend using a version manager like [`nvm`](https://github.com/nvm-sh/nvm)). Node is used for testing JS. It also installs `wasm-pack`, which wraps `cargo` and creates the WASM package for upload to NPM
    * See node version in `.nvmrc`
3. Install `make`
    * Linux/Unix: it's probably already on your system. If not, google "install make on [your OS here]"
    * Windows: http://gnuwin32.sourceforge.net/packages/make.htm

### Developer Installation

Install `wasm-pack` alongside node dependencies. FYI, all of the Rust dependencies will be installed the first time you build or test the project.

```sh
npm i
```

### Testing

* Test everything - Rust, WASM, and JS
  ```sh
  make test -k
  ```
  (You don't have to use `-k` but it ensures all tests run even if an earlier test fails (see [`make` documentation](https://www.gnu.org/software/make/manual/html_node/Errors.html)))
* Just test Rust
  ```sh
  make test.rust
  ```
* Just test WASM and JS
  ```sh
  make test.js
  ```

### CI/CD

Tests run automatically when you push your code. Merging to master automatically publishes a new version of the package to NPM. **You MUST change the version number to publish the new version of the package to NPM** - publishing will fail if the version has not changed. Note, the version in `Cargo.toml` is what determines the version in NPM. The version in `./package.json` does not affect anything.

* Try to stick to [semver](https://semver.org/)
* We're using GitHub Actions for CI/CD. The [standard environment](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/software-installed-on-github-hosted-runners) includes Rust and Node tooling, but we're still specifying versions to be safe.
  * FYI, here are some notes on [caching Rust](https://github.com/actions/cache/blob/master/examples.md#rust---cargo)

#### Future Work

* Move the test job into an action?
* Use artifacts to streamline publishing? [upload](https://github.com/actions/upload-artifact), [download](https://github.com/actions/download-artifact)
