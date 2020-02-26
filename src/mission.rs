//! High-level functions to build a mission using EVA timeline terminology

use super::schedule::{Episode, Schedule};
use std::collections::BTreeMap;
use std::fmt;
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

/// A high-level action in the timeline
#[wasm_bindgen(inspectable)]
#[derive(Clone, Debug, Default, Eq, Ord, PartialEq, PartialOrd)]
pub struct Step {
    episode: Episode,
    actor: String,
    parent: String,
    description: String,
}

impl fmt::Display for Step {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}/{} for {}", self.parent, self.description, self.actor)
    }
}

/// A set of actions being performed by different people
#[wasm_bindgen]
#[derive(Default)]
pub struct Mission {
    steps_by_actor: BTreeMap<String, Vec<Step>>,
    /// housekeeping to keep track of Episode identifiers
    steps: Vec<Step>,
    schedule: Schedule,
}

#[wasm_bindgen]
impl Mission {
    /// Create a new Mission
    #[wasm_bindgen(catch, constructor)]
    pub fn new() -> Result<Mission, JsValue> {
        let mut p = Schedule::new();

        let episode = p.add_episode(Some(vec![0., std::f64::MAX]));
        let mut m = Mission {
            schedule: p,
            ..Default::default()
        };

        m.add_step(
            &episode,
            "ALL".to_string(),
            "__ROOT__".to_string(),
            String::from(LIM_CONS),
        )?;
        Ok(m)
    }

    /// Add a step with bookkeeping
    fn add_step(
        &mut self,
        episode: &Episode,
        actor: String,
        parent: String,
        description: String,
    ) -> Result<Step, String> {
        let step = Step {
            episode: *episode,
            actor: actor,
            parent: parent,
            description: description,
        };
        if self.has_step(&step) {
            return Err(format!("duplicate step {}", step));
        }

        let s = step.clone();
        self.steps.push(s);
        Ok(step)
    }

    /// Whether or not this exact step already exists in the Schedule
    fn has_step(&self, step: &Step) -> bool {
        self.steps.iter().any(|s| *s == *step)
    }

    /// Create a sync section in the timeline
    #[wasm_bindgen(catch, js_name = createSync)]
    pub fn create_sync(
        &mut self,
        description: String,
        duration: Vec<f64>,
    ) -> Result<Step, JsValue> {
        let episode = self.schedule.add_episode(Some(duration));
        match self.add_step(
            &episode,
            "ALL".to_string(),
            LIM_CONS.to_string(),
            description,
        ) {
            Ok(s) => Ok(s),
            Err(e) => Err(JsValue::from_str(&e)),
        }
    }

    /// Create a new step
    #[wasm_bindgen(js_name = createStep)]
    pub fn create_step() {}

    /// Get the available actors in a mission
    pub fn actors(mission: &Mission) -> JsValue {
        let actors: Vec<&String> = mission.steps_by_actor.keys().collect();
        JsValue::from_serde(&actors).unwrap()
    }

    pub fn update_limiting() {}

    pub fn eva_start() {
        // commit the root's execution window to 0
    }

    pub fn add_substep() {}

    pub fn concat_steps() {}

    pub fn finish_step() {}

    // https://github.com/serde-rs/json/issues/456
    // maybe dump graph to the d3.js format of nodes and edges?
    #[wasm_bindgen(js_name = d3Dump)]
    pub fn d3_dump(&self) {}

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
}
