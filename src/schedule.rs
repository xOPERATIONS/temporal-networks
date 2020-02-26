//! # Schedule
//! Defines an API designed to be exported to WASM that can perform time math without requiring the user to understand the underlying data structures or algorithms.
//!
//! ## Nomenclature (and some types)
//!
//! We're drawing terminology from existing planners and the literature on temporal plans. Eg. see [1] pg 519 (also in docs/references/).
//!
//! * **`Schedule`**: a set of temporal constraints describing a set of Episodes to occur. Our implementation of `Schedule` can currently handle Episodes that occur in series or parallel (or any mix thereof)
//! * **Event**: a moment in time in the `Schedule`
//! * **`Episode`**: A pair of start and end `Event`s
//! * **`Interval`**: A span of time represented in [lower, upper] range
//! * **Duration**: An interval in the context of a `Episode`, ie, the interval between the start and end events. In English, an Episode with a [lower, upper] duration is "an episode that will take between lower and upper units of time to complete".
//!
//! [1] Ono, M., Williams, B. C., & Blackmore, L. (2013). Probabilistic planning for continuous dynamic systems under bounded risk. Journal of Artificial Intelligence Research, 46, 511–577. https://doi.org/10.1613/jair.3893

use petgraph::graphmap::DiGraphMap;
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

use super::algorithms::floyd_warshall;
use super::interval::Interval;

/// An ID representing an event in the Schedule
pub type EventID = i32;

/// An Episode represents a logical action that occurs over a period of time. It implicitly has start and end events, which are used by `Schedule`
#[wasm_bindgen]
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq, Ord, PartialOrd)]
pub struct Episode(pub EventID, pub EventID);

#[wasm_bindgen]
impl Episode {
    /// Represents the start of the Episode
    #[wasm_bindgen(getter)]
    pub fn start(&self) -> EventID {
        self.0
    }

    /// Represents the end of the Episode
    #[wasm_bindgen(getter)]
    pub fn end(&self) -> EventID {
        self.1
    }
}

/// A `Schedule` orchestrates events and the timing constraints between them. It allows for querying arbitrary timing information with knowledge of the underlying data structure.
///
/// # Example
///
/// Creating a Schedule and adding Episodes with constraints in Rust
///
/// ```
/// use temporal_networks::schedule::Schedule;
/// use temporal_networks::interval::Interval;
///
/// // create a Schedule
/// let mut schedule = Schedule::new();
///
/// // add an Episode to the Schedule that takes between 6 and 17 time units to complete
/// let Episode1 = schedule.add_episode(Some(vec![6., 17.]));
///
/// // add another Episode and a constraint that the second occurs after the first
/// let Episode2 = schedule.add_episode(Some(vec![8., 29.]));
/// schedule.add_constraint(Episode1.end(), Episode2.start(), None);
///
/// // find the [lower, upper] interval between the start of the Schedule and the start of the second Episode
/// let root = schedule.root().unwrap();
/// let result = schedule.interval(root, Episode2.start()).unwrap();
///
/// // you may notice the interval between the start of the Schedule and the second Episode is just the duration of the first Episode!
/// assert_eq!(result, Interval::new(6., 17.));
/// ```
#[wasm_bindgen]
#[derive(Debug, Default)]
pub struct Schedule {
    /// the STN as Schedulened by the user
    stn: DiGraphMap<EventID, f64>,
    // STN in dispatchable form after APSP
    dispatchable: DiGraphMap<EventID, f64>,
    /// Execution windows when each event can be scheduled. Referenced to a timeframe where the Schedule.root() is t=0
    execution_windows: BTreeMap<EventID, Interval>,
    /// User-provided inputs about event completion. Also referenced to a timeframe where Schedule.root() is t=0
    committments: BTreeMap<EventID, f64>,
    /// Whether or not changes have been made since the last compile
    dirty: bool,
}

#[wasm_bindgen]
impl Schedule {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Schedule {
        Schedule {
            dirty: true,
            ..Default::default()
        }
    }

    /// Get the first event in the Schedule. Found implicitly based on the current constraints
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

    /// List event IDs in chronological order
    pub fn order(&self) -> Vec<EventID> {
        // TODO
        vec![0]
    }

    /// Low-level API for creating nodes in the graph. Advanced use only. If you can't explain why you should use this over `addEpisode`, use `addEpisode` instead
    #[wasm_bindgen(js_name = createEvent)]
    pub fn create_event(&mut self) -> EventID {
        let event_id = self.stn.node_count() as i32;
        self.execution_windows
            .insert(event_id, Interval(-std::f64::MAX, std::f64::MAX));
        let n = self.stn.add_node(event_id);

        self.dirty = true;
        n
    }

    /// Build an Episode but don't add it to the graph
    fn new_episode(&mut self) -> Episode {
        let start_id = self.create_event();
        let end_id = self.create_event();
        Episode(start_id, end_id)
    }

    /// Create a new Episode and add it to this Schedule
    #[wasm_bindgen(catch, js_name = addEpisode)]
    pub fn add_episode(&mut self, duration: Option<Vec<f64>>) -> Episode {
        let d = duration.unwrap_or(vec![0., 0.]);
        let i = Interval::from_vec(d);

        // create the Episode and add edges for its interval
        // make it a distance graph so the lower bound is negative
        let episode = self.new_episode();
        self.stn.add_edge(episode.0, episode.1, i.upper());
        self.stn.add_edge(episode.1, episode.0, -i.lower());

        self.dirty = true;
        episode
    }

    /// Get the controllable duration of an Episode
    #[wasm_bindgen(js_name = getDuration)]
    pub fn get_duration(&self, s: &Episode) -> Interval {
        let lower = self.stn.edge_weight(s.1, s.0).unwrap_or(&0.);
        let upper = self.stn.edge_weight(s.0, s.1).unwrap_or(&0.);
        Interval::new(-*lower, *upper)
    }

    /// Compile the Schedule into a dispatchable form. A dispatchable form is required to query the Schedule for almost any scheduling information. This method is called implicitly when you attempt to query the Schedule when the dispatchable graph is not up-to-date. However, you can proactively call `compile` at a time that is computationally convenient for your application to avoid paying the performance penalty when querying the Schedule
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

    /// Low-level API for marking an event complete. Advanced use only. If you can't explain why you should use this over `completeEpisode`, use `completeEpisode` instead. Commits an event to a time within its interval and greedily updates the schedule for remaining events. Time is in elapsed time since the Schedule started
    #[wasm_bindgen(catch, js_name = commitEvent)]
    pub fn commit_event(&mut self, event: EventID, time: f64) -> Result<(), JsValue> {
        self.committments.insert(event, time);
        self.execution_windows
            .insert(event, Interval::new(time, time));
        self.update_schedule(event)?;

        Ok(())
    }

    /// Mark an Episode complete to update the schedule to following Episodes. The time should be the elapsed time since the Schedule started (in the same units as well)
    #[wasm_bindgen(catch, js_name = completeEpisode)]
    pub fn complete_episode(&mut self, episode: &Episode, time: f64) -> Result<(), JsValue> {
        self.commit_event(episode.end(), time)?;
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
                "Source {} is not already in the Schedule. Have you added it with `addEpisode`?",
                source
            )));
        }
        if !self.stn.contains_node(target) {
            return Err(JsValue::from_str(&format!(
                "Target {} is not already in the Schedule. Have you added it with `addEpisode`?",
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
        // TODO
    }

    /// Add a constraint between the start or end of two events. Errs if either source or target is not already in the Schedule. Defaults to a [0, 0] interval between events
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
                "Source {} is not already in the Schedule. Have you added it with `addEpisode`?",
                source
            )));
        }
        if !self.stn.contains_node(target) {
            return Err(JsValue::from_str(&format!(
                "Target {} is not already in the Schedule. Have you added it with `addEpisode`?",
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
