//! EVA-specific high-level functions

use super::plan::{EventID, Period, Plan};
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

trait Branchable {
    fn start_event(&self) -> EventID;
}

#[wasm_bindgen]
pub struct Mission {
    periods_by_actor: BTreeMap<String, Vec<Period>>,
}

// impl Branchable for Mission {
//     fn start_event(&self) -> EventID {
//         EventID(0)
//     }
// }

#[wasm_bindgen]
pub struct Sync {}

// impl Branchable for Sync {
//     fn start_event(&self) -> EventID {
//         EventID(0)
//     }
// }

/// Create a mission
#[wasm_bindgen(js_name = createMission)]
pub fn create_mission() -> Plan {
    let mut p = Plan::new();
    p.add_period(String::from(LIM_CONS), Some(vec![0., std::f64::MAX]));
    p
}

// /// Create a new step
// #[wasm_bindgen(js_name = createStep)]
// pub fn create_step<T: Branchable>(t: T) {}

/// Get the available actors in a mission
pub fn actors(mission: &Mission) -> JsValue {
    let actors: Vec<&String> = mission.periods_by_actor.keys().collect();
    JsValue::from_serde(&actors).unwrap()
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
// maybe dump graph to the d3.js format of nodes and edges?
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
