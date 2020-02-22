//! EVA-specific high-level functions for a mission

use super::plan::{Period, Plan};
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

/// Actor, Parent, Description tuple
#[wasm_bindgen(inspectable)]
#[derive(Clone, Debug, Default, Eq, Ord, PartialEq, PartialOrd)]
pub struct Step(Period, String, String, String);

impl fmt::Display for Step {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}/{} for {}", self.2, self.3, self.1)
    }
}

/// A set of actions being performed by different people
#[wasm_bindgen]
#[derive(Default)]
pub struct Mission {
    periods_by_actor: BTreeMap<String, Vec<Period>>,
    /// housekeeping to keep track of Period identifiers
    steps: Vec<Step>,
    plan: Plan,
}

#[wasm_bindgen]
impl Mission {
    /// Create a new Mission
    #[wasm_bindgen(catch, constructor)]
    pub fn new() -> Result<Mission, JsValue> {
        let mut p = Plan::new();

        let period = p.add_period(Some(vec![0., std::f64::MAX]));
        let mut m = Mission {
            plan: p,
            ..Default::default()
        };

        m.add_step(
            &period,
            "ALL".to_string(),
            "__ROOT__".to_string(),
            String::from(LIM_CONS),
        )?;
        Ok(m)
    }

    /// Add a step with bookkeeping
    fn add_step(
        &mut self,
        period: &Period,
        actor: String,
        parent: String,
        description: String,
    ) -> Result<Step, String> {
        let step = Step(*period, actor, parent, description);
        if self.has_step(&step) {
            return Err(format!("duplicate step {}", step));
        }

        let s = step.clone();
        self.steps.push(s);
        Ok(step)
    }

    /// Whether or not this exact step already exists in the plan
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
        let period = self.plan.add_period(Some(duration));
        match self.add_step(
            &period,
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
        let actors: Vec<&String> = mission.periods_by_actor.keys().collect();
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
