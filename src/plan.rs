//! # Plan
//! Defines an API designed to be exported to WASM that can perform time math without requiring the user to understand the underlying data structures or algorithms.
//!
//! ## Nomenclature (and some types)
//! * **`Plan`**: a set of temporal constraints describing a set of Periods to occur. Our implementation of `Plan` can currently handle Periods that occur in series or parallel (or any mix thereof)
//! * **Event**: a moment in time in the `Plan`
//! * **`Period`**: A pair of start and end `Event`s
//! * **`Interval`**: A span of time represented in [lower, upper] range
//! * **Duration**: An interval in the context of a `Period`, ie, the interval between the start and end events. In English, an Period with a [lower, upper] duration is "an Period that will take between lower and upper units of time to complete".

use petgraph::graphmap::DiGraphMap;
use std::collections::BTreeMap;
use std::fmt;
use std::string::String;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

use super::algorithms::floyd_warshall;
use super::interval::Interval;

/// An ID representing an event in the plan
type EventID = i32;

/// An Period represents a logical action that occurs over a period of time. It implicitly has start and end events, which are used by `Plan`
#[wasm_bindgen]
#[derive(Clone, Debug, Default)]
pub struct Period(pub EventID, pub EventID, String);

#[wasm_bindgen]
impl Period {
    /// Represents the unique identifier of the Period
    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.2.clone()
    }

    /// Represents the start of the Period
    #[wasm_bindgen(getter)]
    pub fn start(&self) -> EventID {
        self.0
    }

    /// Represents the end of the Period
    #[wasm_bindgen(getter)]
    pub fn end(&self) -> EventID {
        self.1
    }
}

impl fmt::Display for Period {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "{}", self.2)
    }
}

/// A `Plan` orchestrates events and the timing constraints between them. It allows for querying arbitrary timing information with knowledge of the underlying data structure.
///
/// # Example
///
/// Creating a Plan and adding Periods with constraints in Rust
///
/// ```
/// use temporal_networks::plan::Plan;
/// use temporal_networks::interval::Interval;
///
/// // create a plan
/// let mut plan = Plan::new();
///
/// // add an Period to the plan that takes between 6 and 17 time units to complete
/// let period1 = plan.add_period("example".to_string(), Some(vec![6., 17.]));
///
/// // add another Period and a constraint that the second occurs after the first
/// let period2 = plan.add_period("another example".to_string(), Some(vec![8., 29.]));
/// plan.add_constraint(period1.end(), period2.start(), None);
///
/// // find the [lower, upper] interval between the start of the plan and the start of the second Period
/// let root = plan.root().unwrap();
/// let result = plan.interval(root, period2.start()).unwrap();
///
/// // you may notice the interval between the start of the plan and the second Period is just the duration of the first Period!
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
    /// User-provided inputs about event completion. Also referenced to a timeframe where plan.root() is t=0
    committments: BTreeMap<EventID, f64>,
    /// housekeeping to keep track of Period identifiers. DiGraphMap can't work with String NodeTraits
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
        self.dispatchable.nodes().find(|s| {
            self.dispatchable
                .neighbors_directed(*s, petgraph::Incoming)
                .all(|t| match self.dispatchable.edge_weight(t, *s) {
                    Some(w) => *w <= 0.,
                    None => false,
                })
        })
    }

    /// Low-level API for creating nodes in the graph. Advanced use only. If you can't explain why you should use this over `addPeriod`, use `addPeriod` instead
    #[wasm_bindgen(js_name = createEvent)]
    pub fn create_event(&mut self, identifier: String) -> EventID {
        let event_id = self.id_to_indices.len() as i32;
        self.id_to_indices.insert(identifier, event_id);
        self.execution_windows
            .insert(event_id, Interval(-std::f64::MAX, std::f64::MAX));
        let n = self.stn.add_node(event_id);

        self.dirty = true;
        n
    }

    /// Build an Period but don't add it to the graph
    fn new_period(&mut self, identifier: String) -> Period {
        let start_identifier = identifier.clone() + "__START";
        let end_identifier = identifier.clone() + "__END";
        let start_id = self.create_event(start_identifier);
        let end_id = self.create_event(end_identifier);
        Period(start_id, end_id, identifier)
    }

    /// Create a new Period and add it to this plan. The identifier is recommended but not required to be unique (being unique may become a requirement in the future)
    #[wasm_bindgen(catch, js_name = addPeriod)]
    pub fn add_period(&mut self, identifier: String, duration: Option<Vec<f64>>) -> Period {
        let d = duration.unwrap_or(vec![0., 0.]);
        let i = Interval::from_vec(d);

        // create the Period and add edges for its interval
        // make it a distance graph so the lower bound is negative
        let period = self.new_period(identifier);
        self.stn.add_edge(period.0, period.1, i.upper());
        self.stn.add_edge(period.1, period.0, -i.lower());

        self.dirty = true;
        period
    }

    /// Get the controllable duration of an Period
    #[wasm_bindgen(js_name = getDuration)]
    pub fn get_duration(&self, s: &Period) -> Interval {
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

        // reset the dispatchable graph
        self.dispatchable = DiGraphMap::new();

        // add all the edges
        for ((source, target), weight) in mappings.iter() {
            self.dispatchable.add_edge(*source, *target, *weight);
        }
        // mark not-dirty as soon as possible so we can use commit_event below, which calls this function, without recursing to this point
        self.dirty = false;

        // update execution windows with known committments
        let c = self.committments.clone();
        for (executed_event, time) in c.iter() {
            self.commit_event(*executed_event, *time)?;
        }

        Ok(())
    }

    /// Greedily update execution windows
    fn update_schedule(&mut self, event: EventID) -> Result<(), JsValue> {
        self.compile()?;

        let d = self.dispatchable.clone();
        for neighbor in d.neighbors(event) {
            if self.committments.contains_key(&neighbor) {
                // neighbor has already been scheduled
                continue;
            }

            let time_to_neighbor = self.interval(event, neighbor)?;
            let neighbor_window = match self.execution_windows.get(&neighbor) {
                Some(i) => i,
                None => return Err(JsValue::from_str(&format!("no such event {}", neighbor))),
            };
            let event_window = match self.execution_windows.get(&event) {
                Some(i) => i,
                None => return Err(JsValue::from_str(&format!("no such event {}", event))),
            };

            // update neighbor execution windows
            // bounds_i = bounds_i ^ (v + time_event_to_neighbor)
            let new_neighbor_window = *neighbor_window & (*event_window + time_to_neighbor);
            self.execution_windows.insert(neighbor, new_neighbor_window);
        }

        Ok(())
    }

    /// Low-level API for marking an event complete. Advanced use only. If you can't explain why you should use this over `completePeriod`, use `completePeriod` instead. Commits an event to a time within its interval and greedily updates the schedule for remaining events. Time is in elapsed time since the plan started
    #[wasm_bindgen(catch, js_name = commitEvent)]
    pub fn commit_event(&mut self, event: EventID, time: f64) -> Result<(), JsValue> {
        self.committments.insert(event, time);
        self.execution_windows
            .insert(event, Interval::new(time, time));
        self.update_schedule(event)?;

        Ok(())
    }

    /// Mark an Period complete to update the schedule to following Periods. The time should be the elapsed time since the plan started (in the same units as well)
    #[wasm_bindgen(catch, js_name = completePeriod)]
    pub fn complete_period(&mut self, period: &Period, time: f64) -> Result<(), JsValue> {
        // TODO: if outside the upper or lower bounds, update the STN?
        self.commit_event(period.end(), time)?;

        Ok(())
    }

    /// Get the execution window of an Event
    #[wasm_bindgen(catch)]
    pub fn window(&self, event: EventID) -> Result<Interval, JsValue> {
        match self.execution_windows.get(&event) {
            Some(i) => Ok(*i),
            None => Err(JsValue::from(&format!("could not find event {}", event))),
        }
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
        let lower = if *l == 0. { -0. } else { *l };

        Ok(Interval::new(-lower, *upper))
    }

    /// Low-level API to get the directional distance between two events. Advanced use only. If you can't explain why you should use this over `interval`, use `interval` instead
    #[wasm_bindgen(js_name = eventDistance)]
    pub fn event_distance(&mut self, source: EventID, target: EventID) -> Result<JsValue, JsValue> {
        // ensure source and target already exist
        if !self.stn.contains_node(source) {
            return Err(JsValue::from_str(&format!(
                "Source {} is not already in the plan. Have you added it with `addPeriod`?",
                source
            )));
        }
        if !self.stn.contains_node(target) {
            return Err(JsValue::from_str(&format!(
                "Target {} is not already in the plan. Have you added it with `addPeriod`?",
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

    pub fn update_interval(&mut self, _source: EventID, _target: EventID, _interval: Interval) {
        //
    }

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
                "Source {} is not already in the plan. Have you added it with `addPeriod`?",
                source
            )));
        }
        if !self.stn.contains_node(target) {
            return Err(JsValue::from_str(&format!(
                "Target {} is not already in the plan. Have you added it with `addPeriod`?",
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
