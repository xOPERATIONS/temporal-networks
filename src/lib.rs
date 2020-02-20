//! # Temporal Networks
//! Temporal Networks for fast and flexible time math. We currently only support Simple Temporal Networks with offline, naive scheduling.

extern crate js_sys;
extern crate wasm_bindgen;

#[macro_use]
extern crate serde_derive;

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

pub mod algorithms;
pub mod interval;
pub mod plan;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// Recommended to run once when this package imported in JS but not required. Calling this message first ensures that any Rust panics that occur later will result in useful stacktraces in JS (as opposed to just getting an opaque `unreachable code` error)
#[wasm_bindgen]
pub fn install() -> Result<(), JsValue> {
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();
    Ok(())
}
