//! # Plan
//! Defines an API designed to be exported to WASM that can perform time math without requiring the user to understand the underlying data structures or algorithms.
//!
//! ## Nomenclature (and some types)
//! * **`Plan`**: a set of temporal constraints describing a set of actions to occur. Our implementation of `Plan` can currently handle actions that occur in series or parallel (or any mix thereof)
//! * **Event**: a moment in time in the `Plan`
//! * **`Step`**: A pair of start and end `Event`s
//! * **`Interval`**: A span of time represented in [lower, upper] range
//! * **Duration**: An interval in the context of a `Step`, ie, the interval between the start and end events. In English, a Step with a [lower, upper] duration is "an action that will take between lower and upper units of time to complete".

use petgraph::graphmap::DiGraphMap;
use std::collections::BTreeMap;
use std::fmt;
use std::string::String;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use web_sys::console;

use super::algorithms::floyd_warshall;
use super::interval::Interval;

/// An ID representing an event in the plan
type EventID = i32;

/// A Step represents a logical action that occurs over a period of time. It implicitly has start and end events, which are used by `Plan`
#[wasm_bindgen]
#[derive(Clone, Debug, Default)]
pub struct Step(pub EventID, pub EventID, String);

#[wasm_bindgen]
impl Step {
    /// Represents the unique identifier of the step
    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.2.clone()
    }

    /// Represents the start of the step
    #[wasm_bindgen(getter)]
    pub fn start(&self) -> EventID {
        self.0
    }

    /// Represents the end of the step
    #[wasm_bindgen(getter)]
    pub fn end(&self) -> EventID {
        self.1
    }
}

impl fmt::Display for Step {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.2)
    }
}

/// A `Plan` orchestrates events and the timing constraints between them. It allows for querying arbitrary timing information with knowledge of the underlying data structure.
///
/// # Example
///
/// Creating a Plan and adding Steps with constraints in Rust
///
/// ```
/// use temporal_networks::plan::Plan;
/// use temporal_networks::interval::Interval;
///
/// // create a plan
/// let mut plan = Plan::new();
///
/// // add a step to the plan that takes between 6 and 17 time units to complete
/// let step1 = plan.add_step("example".to_string(), Some(vec![6., 17.]));
///
/// // add another step and a constraint that the second occurs after the first
/// let step2 = plan.add_step("another example".to_string(), Some(vec![8., 29.]));
/// plan.add_constraint(step1.end(), step2.start(), None);
///
/// // find the [lower, upper] interval between the start of the plan and the start of the second step
/// let root = plan.root().unwrap();
/// let result = plan.interval(root, step2.start()).unwrap();
///
/// // you may notice the interval between the start of the plan and the second step is just the duration of the first step!
/// assert_eq!(result, Interval::new(6., 17.));
/// ```
#[wasm_bindgen]
#[derive(Debug, Default)]
pub struct Plan {
    /// the STN as planned by the user
    stn: DiGraphMap<EventID, f64>,
    // STN in dispatchable form after APSP
    dispatchable: DiGraphMap<EventID, f64>,
    /// Execution windows when each event can be scheduled. Referenced to a timeframe where the plan.root() is t=0
    execution_windows: BTreeMap<EventID, Interval>,
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
            dirty: true,
            ..Default::default()
        }
    }

    /// Get the first event in the plan. Found implicitly based on the current constraints
    #[wasm_bindgen(getter)]
    pub fn root(&mut self) -> Option<EventID> {
        match self.compile() {
            Ok(_) => (),
            Err(_e) => return None,
        };

        // all incoming edges should be <= 0 for the first node
        let ret = self.dispatchable.nodes().find(|s| {
            self.dispatchable
                .neighbors_directed(*s, petgraph::Incoming)
                .all(|t| match self.dispatchable.edge_weight(t, *s) {
                    Some(w) => *w <= 0.,
                    None => false,
                })
        });
        // console::log_1(&JsValue::from_serde(&ret).unwrap());
        ret
    }

    /// Low-level API for creating nodes in the graph. Advanced use only. If you can't explain why you should use this over `addStep`, use `addStep` instead
    #[wasm_bindgen(js_name = createEvent)]
    pub fn create_event(&mut self, identifier: String) -> EventID {
        let id = self.id_to_indices.len() as i32;
        self.id_to_indices.insert(identifier, id);
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

    /// Create a new step and add it to this plan. The identifier is recommended but not required to be unique (being unique may become a requirement in the future)
    #[wasm_bindgen(catch, js_name = addStep)]
    pub fn add_step(&mut self, identifier: String, duration: Option<Vec<f64>>) -> Step {
        let d = duration.unwrap_or(vec![0., 0.]);
        let i = Interval::from_vec(d);

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
    pub fn get_duration(&self, s: &Step) -> Interval {
        let lower = self.stn.edge_weight(s.1, s.0).unwrap_or(&0.);
        let upper = self.stn.edge_weight(s.0, s.1).unwrap_or(&0.);
        Interval::new(-*lower, *upper)
    }

    /// Compile the plan into a dispatchable form. A dispatchable form is required to query the plan for almost any scheduling information. This method is called implicitly when you attempt to query the plan when the dispatchable graph is not up-to-date. However, you can proactively call `compile` at a time that is computationally convenient for your application to avoid paying the performance penalty when querying the plan
    #[wasm_bindgen(catch)]
    pub fn compile(&mut self) -> Result<(), JsValue> {
        if !self.dirty {
            return Ok(());
        }

        // run all-pairs shortest paths
        let mappings = match floyd_warshall(&self.stn) {
            Ok(d) => d,
            Err(e) => return Err(JsValue::from_str(&e)),
        };

        // let s = format!("{:?}", mappings);
        // console::log_1(&JsValue::from(&s));

        // reset the dispatchable graph
        self.dispatchable = DiGraphMap::new();

        // add all the edges
        for ((source, target), weight) in mappings.iter() {
            self.dispatchable.add_edge(*source, *target, *weight);
        }

        self.dirty = false;
        Ok(())
    }

    /// Greedily update execution windows
    fn update_schedule(&mut self, event: EventID) -> Result<(), JsValue> {
        self.compile()?;

        let d = self.dispatchable.clone();
        for neighbor in d.neighbors(event) {
            let mut neighbor_window = match self.execution_windows.get(&neighbor) {
                Some(i) => i,
                None => return Err(JsValue::from_str(&format!("no such event {}", neighbor))),
            };
            // check that the execution window hasn't converged to a [same, same] interval, which would indicate it has already been scheduled
            if neighbor_window.converged() {
                continue;
            }
            let event_window = match self.execution_windows.get(&event) {
                Some(i) => i,
                None => return Err(JsValue::from_str(&format!("no such event {}", event))),
            };

            let time_to_neighbor = self.interval(event, neighbor)?;

            neighbor_window = neighbor_window & (event_window + time_to_neighbor);
            self.execution_windows.insert(*neighbor, neighbor_window);
        }

        Ok(())
    }

    /// Low-level API for marking an event complete. Advanced use only. If you can't explain why you should use this over `completeStep`, use `completeStep` instead. Commits an event to a time within its interval and greedily updates the schedule for remaining events. Time is in elapsed time since the plan started
    #[wasm_bindgen(catch, js_name = commitEvent)]
    pub fn commit_event(&mut self, event: EventID, time: f64) -> Result<(), JsValue> {
        self.execution_windows
            .insert(event, Interval::new(time, time));
        self.update_schedule(event)?;

        Ok(())
    }

    /// Mark a step complete to update the schedule to following steps. The time should be the elapsed time since the plan started (in the same units as well)
    #[wasm_bindgen(catch, js_name = completeStep)]
    pub fn complete_step(&mut self, step: &Step, time: f64) -> Result<(), JsValue> {
        // TODO: check that the start has been committed too? set it to the end of the previous step if it was somehow missed?

        // TODO: if outside the upper or lower bounds, update the STN?
        self.commit_event(step.end(), time);

        Ok(())
    }

    /// Get the interval between two events
    #[wasm_bindgen(catch)]
    pub fn interval(&mut self, source: EventID, target: EventID) -> Result<Interval, JsValue> {
        self.compile()?;

        let l = match self.dispatchable.edge_weight(target, source) {
            Some(l) => l,
            None => {
                return Err(JsValue::from_str(&format!(
                    "missing lower edge: {} to {}",
                    target, source
                )))
            }
        };

        let upper = match self.dispatchable.edge_weight(source, target) {
            Some(u) => u,
            None => {
                return Err(JsValue::from_str(&format!(
                    "missing upper edge: {} to {}",
                    source, target
                )))
            }
        };

        // avoid returning -0
        let lower: f64;
        if *l == 0. {
            lower = -0.;
        } else {
            lower = *l;
        }

        Ok(Interval::new(-lower, *upper))
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

        match self.compile() {
            Ok(_) => (),
            Err(e) => return Err(e),
        }

        let t = match self.dispatchable.edge_weight(source, target) {
            Some(t) => t,
            None => return Err(JsValue::from_str(&"Cannot find path from start to target")),
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
        let i = Interval::from_vec(d);

        self.stn.add_edge(source, target, i.upper());
        self.stn.add_edge(target, source, -i.lower());

        self.dirty = true;
        Ok(())
    }

    pub fn remove_constraint() {}

    pub fn remove_constraints() {}
}
