//! # Plan
//! Defines an API designed to be exported to WASM that can perform time math without requiring the user to understand the underlying data structures or algorithms.
//!
//! ## Nomenclature (and types)
//! * **`Plan`**: a set of temporal constraints describing a set of actions to occur. Our implementation of `Plan` can currently handle actions that occur in series or parallel (or any mix thereof)
//! * **`Event`**: a moment in time in the `Plan`
//! * **`Step`**: A pair of start and end `Event`s
//! * **`Interval`**: A span of time represented in [lower, upper] range
//! * **`Duration`**: An interval in the context of a `Step`, ie, the interval between the start and end events. In English, a Step with a [lower, upper] duration is "an action that will take between lower and upper units of time to complete".

use petgraph::graphmap::DiGraphMap;
use std::collections::BTreeMap;
use std::string::String;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

use super::algorithms::floyd_warshall;
use super::interval;

/// An ID representing an event in the plan
type EventID = i32;

/// Steps represent a logical action that occurs over a period of time. They implicitly generate start and end events, which are used by `Plan`
#[wasm_bindgen]
#[derive(Clone, Debug, Default)]
pub struct Step(EventID, EventID, String);

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
    stn: DiGraphMap<EventID, f64>,
    dispatchable: DiGraphMap<EventID, f64>,
    /// Debugging
    constraint_table: BTreeMap<(EventID, EventID), f64>,
    /// housekeeping to keep track of step identifiers. DiGraphMap can't work with String NodeTraits
    id_to_indices: BTreeMap<String, EventID>,
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
            constraint_table: BTreeMap::new(),
            id_to_indices: BTreeMap::new(),
            dirty: true,
        }
    }

    /// Get the first event in the plan. Found implicitly based on the current constraints
    #[wasm_bindgen(getter)]
    pub fn root(&mut self) -> Option<EventID> {
        if self.dirty {
            match self.compile() {
                Ok(_) => (),
                Err(_e) => return None,
            };
        }

        // all incoming edges should be <= 0 for the first node
        self.dispatchable.nodes().find(|s| {
            self.dispatchable
                .neighbors_directed(*s, petgraph::Incoming)
                .all(|t| match self.dispatchable.edge_weight(t, *s) {
                    Some(w) => *w <= 0.,
                    None => false,
                })
        })
    }

    /// Low-level API for creating nodes in the graph. Advanced use only. If you can't explain why you should use this over `addStep`, use `addStep` instead
    #[wasm_bindgen(js_name = createEvent)]
    pub fn create_event(&mut self, identifier: String) -> EventID {
        let id = self.id_to_indices.len() as i32;
        self.id_to_indices.insert(identifier.clone(), id);
        let n = self.stn.add_node(id);

        self.dirty = true;
        n
    }

    /// Build a step but don't add it to the graph
    fn new_step(&mut self, identifier: String) -> Step {
        let start_identifier = identifier.clone() + "__START";
        let end_identifier = identifier.clone() + "__END";
        let start_id = self.create_event(start_identifier);
        let end_id = self.create_event(end_identifier);
        Step(start_id, end_id, identifier)
    }

    /// Create a new step and add it to this plan
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

        // track the constraint table for debugging
        self.constraint_table = mappings.clone();

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

    /// Get the interval between two events
    #[wasm_bindgen(catch)]
    pub fn interval(
        &mut self,
        source: EventID,
        target: EventID,
    ) -> Result<interval::Interval, JsValue> {
        if self.dirty {
            self.compile()?;
        }

        let lower = match self.dispatchable.edge_weight(target, source) {
            Some(l) => l,
            None => {
                return Err(JsValue::from_str(&format!(
                    "missing lower edge: {} to {}",
                    target, source
                )))
            }
        };

        let upper = match self.dispatchable.edge_weight(source, target) {
            Some(l) => l,
            None => {
                return Err(JsValue::from_str(&format!(
                    "missing upper edge: {} to {}",
                    source, target
                )))
            }
        };

        Ok(interval::Interval::new(-*lower, *upper))
    }

    /// Low-level API to get the directional distance between two events. Advanced use only. If you can't explain why you should use this over `interval`, use `interval` instead
    #[wasm_bindgen(js_name = eventDistance)]
    pub fn event_distance(&mut self, source: EventID, target: EventID) -> Result<JsValue, JsValue> {
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

    // TODO: take StepID, not step
    pub fn update_duration() {}

    /// Add a constraint between the start or end of two events. Errs if either source or target is not already in the plan. Defaults to a [0, 0] interval between events
    #[wasm_bindgen(js_name = addConstraint)]
    pub fn add_constraint(
        &mut self,
        source: EventID,
        target: EventID,
        interval: Option<Vec<f64>>,
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

        let d = interval.unwrap_or(vec![0., 0.]);
        let i = interval::from_vec(d);

        self.stn.add_edge(source, target, i.upper());
        self.stn.add_edge(target, source, -i.lower());

        self.dirty = true;
        Ok(())
    }

    pub fn remove_constrainst() {}

    pub fn remove_constrainsts() {}
}
