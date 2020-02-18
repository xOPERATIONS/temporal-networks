//! # Temporal Networks
//! Temporal Networks for fast and flexible time math. We currently only support Simple Temporal Networks with offline, naive scheduling.

extern crate js_sys;
extern crate wasm_bindgen;

#[macro_use]
extern crate serde_derive;

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use web_sys::console;

pub mod algorithms;
pub mod interval;
pub mod plan;
pub mod stn;

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
pub fn run() -> Result<(), JsValue> {
  #[cfg(debug_assertions)]
  console_error_panic_hook::set_once();

  console::log_1(&JsValue::from_str("Initialized STN library"));

  Ok(())
}
