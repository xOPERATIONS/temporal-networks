//! EVA-specific high-level functions

use super::plan::{Period, Plan};
use std::collections::BTreeMap;
use std::string::String;
use wasm_bindgen::prelude::*;

// https://rustwasm.github.io/wasm-bindgen/reference/attributes/on-rust-exports/typescript_custom_section.html
#[wasm_bindgen(typescript_custom_section)]
const TS_APPEND_CONTENT: &'static str = r#"
/**
* Represents the limiting consumable constraint in any mission
*/
export const LIM_CONS = "LIM CONS";
"#;
const LIM_CONS: &'static str = "LIM CONS";

struct Mission {
    pub periods_by_actor: BTreeMap<String, Vec<Period>>,
}

pub fn create_eva() -> Plan {
    let mut p = Plan::new();
    let limCons = p.add_period(String::from(LIM_CONS), Some(vec![0., std::f64::MAX]));
    p
}

pub fn update_limiting() {}

pub fn eva_start() {
    // commit the root's execution window to 0
}

pub fn add_step(_actor: String, _description: String) {
    // use the actor to make sure the description is unique
    // TODO: make sure the description isn't used elsewhere? or just throw a random hash on it
}

pub fn add_substep() {}

pub fn concat_steps() {}

pub fn finish_step() {}

// https://github.com/serde-rs/json/issues/456
// maybe dump to the d3.js format of nodes and edges?
pub fn d3_dump() {}

pub fn step_stats() {
    /*
    {
        PET until
        PET at start
        GMT at start
    }
    */
}

pub fn actions_at() {}

pub fn diff() {
    // first - second
    // return [lower, upper], not interval
}
