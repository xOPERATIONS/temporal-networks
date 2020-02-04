# Temporal Networks

Implements Simple Temporal Networks in Rust and compiles to WASM for use in any JS project.

[Library documentation](https://xoperations.github.io/temporal-networks/stn/)

## What is a Simple Temporal Network?

* See [here](./docs/references/STNs_for_EVAs.pdf) for a tutorial
* There are additional papers in [docs/references](./docs/references/)

## Installation

```sh
npm i # TODO
```

## Development

### Dependencies

1. [Install rust/cargo](https://doc.rust-lang.org/cargo/getting-started/installation.html)
2. [Install Node](https://nodejs.org/en/download/) (or use a version manager like [`nvm`](https://github.com/nvm-sh/nvm))
3. Install `make`
  * Linux/Unix: it's probably already on your system. If not, google "install make on [your OS here]"
  * Windows: http://gnuwin32.sourceforge.net/packages/make.htm

### Run Locally without Publishing

TODO

### Testing

* Test Rust, WASM, and JS
  ```sh
  make test
  ```
* Just test Rust
  ```sh
  make test.rust
  ```

### Publishing

TODO
