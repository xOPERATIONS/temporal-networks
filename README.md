# Temporal Networks

Temporal Networks in JavaScript. Compiled to [wasm](https://webassembly.org/) from [Rust](https://www.rust-lang.org/) for use in any JavaScript project.

[JS documentation](https://xoperations.github.io/temporal-networks/js/modules/_index_d_.html) | [Rust documentation](https://xoperations.github.io/temporal-networks/rust/temporal_networks/)

[![npm version](https://img.shields.io/npm/v/@xoperations/temporal-networks.svg?style=flat)](https://npmjs.org/package/@xoperations/temporal-networks "View this project on npm")

## What is a Temporal Network?

Temporal networks are data structures designed to simplify time math. They were created by the AI and computer science communities to automatically schedule the actions taken by robots or other intelligent systems. In short, a temporal network is a graph structure representing a timeline that can be queried for information such as "how long until X occurs?", "what's the latest that we can start Y?", "how much margin do we have to complete Z?", and almost any other time related question you can imagine.

There are a number of formulations of temporal networks with the most common being Simple Temporal Networks (STNs). STNs allow for reasoning about actions that are occuring in series or in parallel with controllable ranges for start and end times. At the moment, this library uses STNs behind the scenes, but it is easily extensible to richer representations of temporal networks such as Simple Temporal Networks with Uncertainty (STNUs), Temporal Plan Networks (TPNs), or Qualitative State Plans (QSPs). STNUs add uncertainty, which is crucial when dealing with events outside of your control. TPNs add the notion of choice, providing a way to build schedules with mutually exclusive avenues for success (eg. letting you pick Task A over Task B). QSPs add the notion of non-time-related constraints, pulling in external requirements to ensure that it is possible to move forward in a timeline (eg. using whether or not a tool is ready at a worksite to allow a certain activity to occur).

For a lot more detail on temporal networks, see [this walkthrough](https://github.com/xOPERATIONS/temporal-networks/blob/master/docs/references/STNs_for_EVAs.pdf). There are additional papers and lecture notes in [docs/references](https://github.com/xOPERATIONS/temporal-networks/blob/master/docs/references/).

### Nomenclature

* **Plan**: a collection of connected steps occuring in series or parallel representing all the actions that need to be completed
* **Step**: an action with a defined start and end
* **Event**: a specific action in the timeline. Eg. the start of a step is an event and the end of a step is a different event
* **Interval**: a [lower, upper] bounded period of time
* **Constraint**: a requirement that two events occur within an interval

### Example STN

Imagine a morning routine of waking up, taking a shower, eating breakfast while reading the news, and driving to work. Here's how you would describe this routine using the nomenclature above.

The whole routine from wake up to arrival at work is the **plan**. The first **event** is waking up. Taking a shower is a **step** with a start event (turning on the hot water?) and an end event (toweling off). Eating breakfast and reading the news are two separate steps happening in parallel. If eating breakfast takes between 10 and 15 minutes, the **interval** between breakfast start and breakfast end is [10, 15]. If you want to finish reading the new within 5 minutes of finishing breakfast, there is a [0, 5] interval **constraint** between the end of reading the news and the end of breakfast. If driving to work takes between 25 and 35 minutes, there is a [25, 35] interval between the start event of driving and end event of driving.

STNs are flexible, so there are multiple ways of building STNs to represent this scenario depending on your interpretation of the constraints between the events.

## End User Installation

```sh
npm i @xoperations/temporal-networks
```

## Usage

In an effort to simplify building temporal networks, this library provides high level functions that reflect the structure of extravehicular activity (EVA) timelines. Sticking to these functions guarantees sane results for most use cases with EVA timelines. However, it also exposes low-level APIs if you need to fine tune your networks.

We recommend building your STNs in the simplest possible way first, testing thoroughly to ensure that the schedules that are generated make sense, then only fine-tuning with the low-level APIs if necessary.

As always, head over to the [JS documentation](https://xoperations.github.io/temporal-networks/js/modules/_index_d_.html) for all the details.

### Example 1: Building a timeline with one activity

```js


```

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

### Linting and IDEs

* JS: [Prettier](https://prettier.io/)
  * We recommend using a code editor extension to run automatically on save
* Rust:[`rustfmt`](https://github.com/rust-lang/rustfmt) for Rust linting
  * You don't need to install anything. Just run `cargo fmt`
  * Or better yet, install a code editor extension to format automatically

I (Cameron) highly recommend using [VS Code](https://code.visualstudio.com/). There are very useful extensions for JS and Rust. This repo includes settings for VS Code to help with linting.

### CI/CD

Tests run automatically when you push your code. Merging to master automatically publishes a new version of the package to NPM. **You MUST change the version number to publish the new version of the package to NPM** - publishing will fail if the version has not changed. Note, the version in `Cargo.toml` is what determines the version in NPM. The version in `./package.json` does not affect anything.

* Try to stick to [semver](https://semver.org/)
* We're using GitHub Actions for CI/CD. The [standard environment](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/software-installed-on-github-hosted-runners) includes Rust and Node tooling, but we're still specifying versions to be safe.
  * FYI, here are some notes on [caching Rust](https://github.com/actions/cache/blob/master/examples.md#rust---cargo)

#### Future Work

* Move the test job into an action?
* Use artifacts to streamline publishing? [upload](https://github.com/actions/upload-artifact), [download](https://github.com/actions/download-artifact)
* Maybe [separate](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/persisting-workflow-data-using-artifacts#passing-data-between-jobs-in-a-workflow) testing and linting jobs?
