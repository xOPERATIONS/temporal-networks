use petgraph::graphmap::DiGraphMap;
use std::collections::BTreeMap;
use std::string::String;
use wasm_bindgen::prelude::*;

use super::interval::Interval;

#[wasm_bindgen(inspectable)]
#[derive(Clone, Copy, Debug, Default)]
pub struct Step(i32, i32);

#[wasm_bindgen]
#[derive(Debug)]
pub struct Plan {
  stn: DiGraphMap<i32, f64>,
  /// housekeeping to keep track of step identifiers. DiGraphMap can't work with String NodeTraits
  id_to_indices: BTreeMap<String, i32>,
  /// Whether or not changes have been made since the last compile
  dirty: bool,
}

#[wasm_bindgen]
impl Plan {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Plan {
    Plan {
      stn: DiGraphMap::new(),
      id_to_indices: BTreeMap::new(),
      dirty: true,
    }
  }

  /// Build a step but don't add it to the graph
  fn new_step(&mut self, identifier: String) -> Step {
    // keep track of IDs
    let start_id = self.id_to_indices.len() as i32;
    let end_id = self.id_to_indices.len() as i32 + 1;

    self
      .id_to_indices
      .insert(identifier.clone() + "START", start_id);
    self.id_to_indices.insert(identifier + "END", end_id);
    Step(start_id, end_id)
  }

  pub fn compile() {}

  pub fn get_schedule() {}

  pub fn complete_step() {}

  pub fn interval_between() {}

  pub fn time_until() {}

  pub fn add_preceding() {}

  pub fn add_following() {}

  pub fn update_duration() {}

  pub fn remove_relationship() {}

  pub fn remove_relationships() {}

  /// Create a new step and add it to this plan. Can optionally follow and/or precede any step in the timeline
  ///
  /// # Example
  /// // TODO: show connecting steps to each other, root nodes
  #[wasm_bindgen(js_name = addStep)]
  pub fn add_step(
    &mut self,
    identifier: String,
    precedes: Option<Step>,
    follows: Option<Step>,
    duration: Option<Interval>,
  ) -> Step {
    let d = duration.unwrap_or_default();

    // create the step and add edges for its interval
    let step = self.new_step(identifier);
    self.stn.add_edge(step.0, step.1, d.upper());
    self.stn.add_edge(step.1, step.0, d.lower());

    // put it into the STN at the appropriate place
    if precedes.is_some() {
      let p = precedes.unwrap_or_default();
      self.stn.add_edge(step.1, p.0, 0.);
    };

    if follows.is_some() {
      let f = follows.unwrap_or_default();
      self.stn.add_edge(f.1, step.0, 0.);
    };

    self.dirty = true;
    step
  }
}
