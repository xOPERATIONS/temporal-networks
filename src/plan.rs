use petgraph::graphmap::DiGraphMap;
use std::collections::BTreeMap;
use std::string::String;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

use super::algorithms::floyd_warshall;
use super::interval;

type StepID = i32;

/// Steps represent a logical action that occurs over a period of time. They implicitly generate start and end events, which are used by `Plan`
#[wasm_bindgen]
#[derive(Clone, Debug, Default)]
pub struct Step(StepID, StepID, String);

#[wasm_bindgen]
impl Step {
    /// Get a string representing this Step
    #[wasm_bindgen(js_name = toString)]
    pub fn to_string(&self) -> String {
        format!("{}", self.2)
    }

    /// Represents the start of the step
    #[wasm_bindgen(getter)]
    pub fn start(&self) -> i32 {
        self.0
    }

    /// Represents the end of the step
    #[wasm_bindgen(getter)]
    pub fn end(&self) -> i32 {
        self.1
    }
}

#[wasm_bindgen]
#[derive(Debug)]
pub struct Plan {
    stn: DiGraphMap<StepID, f64>,
    dispatchable: DiGraphMap<StepID, f64>,
    /// housekeeping to keep track of step identifiers. DiGraphMap can't work with String NodeTraits
    id_to_indices: BTreeMap<String, StepID>,
    /// Whether or not changes have been made since the last compile
    dirty: bool,
}

#[wasm_bindgen]
impl Plan {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Plan {
        Plan {
            stn: DiGraphMap::new(),
            dispatchable: DiGraphMap::new(),
            id_to_indices: BTreeMap::new(),
            dirty: true,
        }
    }

    /// Get the first node in the plan
    fn first_node(&mut self) -> Option<StepID> {
        if self.dirty {
            match self.compile() {
                Ok(_) => (),
                Err(_e) => return None,
            };
        }

        self.dispatchable.nodes().find(|n| {
            self.dispatchable
                .edges(*n)
                .all(|(_s, _t, weight)| *weight >= 0.)
        })
    }

    /// Build a step but don't add it to the graph
    fn new_step(&mut self, identifier: String) -> Step {
        // keep track of IDs
        let start_id = self.id_to_indices.len() as i32;
        let end_id = self.id_to_indices.len() as i32 + 1;

        self.id_to_indices
            .insert(identifier.clone() + "__START", start_id);
        self.id_to_indices
            .insert(identifier.clone() + "__END", end_id);
        Step(start_id, end_id, identifier)
    }

    /// Create a new step and add it to this plan. Can optionally follow and/or precede any step in the timeline
    #[wasm_bindgen(catch, js_name = addStep)]
    pub fn add_step(&mut self, identifier: String, duration: Option<Vec<f64>>) -> Step {
        let d = duration.unwrap_or(vec![0., 0.]);
        let i = interval::from_vec(d);

        // create the step and add edges for its interval
        // make it a distance graph so the lower bound is negative
        let step = self.new_step(identifier);
        self.stn.add_edge(step.0, step.1, i.upper());
        self.stn.add_edge(step.1, step.0, -i.lower());

        self.dirty = true;
        step
    }

    /// Get the controllable duration of a step
    #[wasm_bindgen(js_name = getDuration)]
    pub fn get_duration(&self, s: &Step) -> interval::Interval {
        let lower = self.stn.edge_weight(s.1, s.0).unwrap_or(&0.);
        let upper = self.stn.edge_weight(s.0, s.1).unwrap_or(&0.);
        interval::Interval::new(-*lower, *upper)
    }

    /// Compile the plan into a dispatchable form. A dispatchable form is required to query the plan for almost any scheduling information. This method is called implicitly when you attempt to query the plan when the dispatchable graph is not up-to-date. However, you can proactively call `compile` at a time that is computationally convenient for your application to avoid paying the performance penalty when querying the plan
    #[wasm_bindgen(catch)]
    pub fn compile(&mut self) -> Result<(), JsValue> {
        // run all-pairs shortest paths
        let mappings = match floyd_warshall(&self.stn) {
            Ok(d) => d,
            Err(e) => return Err(JsValue::from_str(&e)),
        };

        // reset the dispatchable graph
        self.dispatchable = DiGraphMap::new();

        // add all the edges
        for ((source, target), weight) in mappings.iter() {
            self.dispatchable.add_edge(*source, *target, *weight);
        }

        self.dirty = false;
        Ok(())
    }

    pub fn get_schedule() {}

    pub fn complete_step() {}

    /// Get the maximum interval between controllable Step `source` and the start of `target`. Could be negative if `target` is chronologically before `source`.
    #[wasm_bindgen(catch, js_name = intervalBetween)]
    pub fn interval_between(
        &mut self,
        source: &Step,
        target: &Step,
    ) -> Result<interval::Interval, JsValue> {
        if self.dirty {
            self.compile()?;
        }

        let lower = match self.dispatchable.edge_weight(target.0, source.0) {
            Some(l) => l,
            None => {
                return Err(JsValue::from_str(&format!(
                    "missing lower edge: end of {} to start of {}",
                    source.2, target.2
                )))
            }
        };

        let upper = match self.dispatchable.edge_weight(source.0, target.0) {
            Some(l) => l,
            None => {
                return Err(JsValue::from_str(&format!(
                    "missing upper edge: start of {} to start of {}",
                    source.2, target.2
                )))
            }
        };

        Ok(interval::Interval::new(-*lower, *upper))
    }

    /// Get the time between two events
    #[wasm_bindgen(js_name = timeBetween)]
    pub fn time_between(&mut self, source: StepID, target: StepID) -> Result<JsValue, JsValue> {
        // ensure source and target already exist
        if !self.stn.contains_node(source) {
            return Err(JsValue::from_str(&format!(
                "Source {} is not already in the plan. Have you added it with `addStep`?",
                source
            )));
        }
        if !self.stn.contains_node(target) {
            return Err(JsValue::from_str(&format!(
                "Target {} is not already in the plan. Have you added it with `addStep`?",
                target
            )));
        }

        if self.dirty {
            match self.compile() {
                Ok(_) => (),
                Err(e) => return Err(e),
            }
        }

        let t = match self.dispatchable.edge_weight(source, target) {
            Some(t) => t,
            None => {
                return Err(JsValue::from_str(&format!(
                    "Cannot find path from start to target"
                )))
            }
        };

        Ok(JsValue::from_f64(*t))
    }

    /// Get the earliest time of an event. Assume 0 indexed on the plan's start
    #[wasm_bindgen(js_name = timeUntil)]
    pub fn time_until(&mut self, target: StepID) -> Result<JsValue, JsValue> {
        if self.dirty {
            match self.compile() {
                Ok(_) => (),
                Err(e) => return Err(e),
            }
        }

        let first = match self.first_node() {
            Some(f) => f,
            None => {
                return Err(JsValue::from_str(&format!(
                    "Cannot pull absolute time because the graph does not have a starting point"
                )))
            }
        };

        self.time_between(first, target)
    }

    // TODO: take StepID, not step
    pub fn update_duration() {}

    /// Add a constraint between the start or end of two events. Errs if either start or end is not already in the plan. Defaults to a [0, 0] interval between events
    #[wasm_bindgen(js_name = addConstraint)]
    pub fn add_constraint(
        &mut self,
        source: StepID,
        target: StepID,
        duration: Option<Vec<f64>>,
    ) -> Result<(), JsValue> {
        // ensure source and target already exist
        if !self.stn.contains_node(source) {
            return Err(JsValue::from_str(&format!(
                "Source {} is not already in the plan. Have you added it with `addStep`?",
                source
            )));
        }
        if !self.stn.contains_node(target) {
            return Err(JsValue::from_str(&format!(
                "Target {} is not already in the plan. Have you added it with `addStep`?",
                target
            )));
        }

        let d = duration.unwrap_or(vec![0., 0.]);
        let i = interval::from_vec(d);

        self.stn.add_edge(source, target, i.upper());
        self.stn.add_edge(target, source, -i.lower());

        self.dirty = true;
        Ok(())
    }

    pub fn remove_constrainst() {}

    pub fn remove_constrainsts() {}
}
