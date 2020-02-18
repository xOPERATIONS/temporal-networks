use petgraph::graphmap::DiGraphMap;
use std::collections::BTreeMap;
use std::string::String;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

use super::algorithms::floyd_warshall;
use super::interval;

#[wasm_bindgen]
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
      .insert(identifier.clone() + "__START", start_id);
    self.id_to_indices.insert(identifier + "__END", end_id);
    Step(start_id, end_id)
  }

  /// Create a new step and add it to this plan. Can optionally follow and/or precede any step in the timeline
  #[wasm_bindgen(js_name = addStep)]
  pub fn add_step(
    &mut self,
    identifier: String,
    duration: Option<Vec<f64>>,
    precedes: Option<Step>,
    follows: Option<Step>,
  ) -> Step {
    let d = duration.unwrap_or(vec![0., 0.]);
    let i = interval::from_vec(d);

    // create the step and add edges for its interval
    // make it a distance graph so the lower bound is negative
    let step = self.new_step(identifier);
    self.stn.add_edge(step.0, step.1, i.upper());
    self.stn.add_edge(step.1, step.0, -i.lower());

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

  /// Get the controllable duration of a step
  #[wasm_bindgen(js_name = getDuration)]
  pub fn get_duration(&self, s: Step) -> interval::Interval {
    let lower = self.stn.edge_weight(s.1, s.0).unwrap_or(&0.);
    let upper = self.stn.edge_weight(s.0, s.1).unwrap_or(&0.);
    interval::Interval::new(-*lower, *upper)
  }

  pub fn compile(&mut self) -> Result<(), JsValue> {
    let _mappings = match floyd_warshall(&self.stn) {
      Ok(d) => d,
      Err(e) => return Err(JsValue::from_str(&e)),
    };

    Ok(())
  }

  pub fn get_schedule() {}

  pub fn complete_step() {}

  pub fn interval_between() {}

  pub fn time_until() {}

  // alias for add_preceding_start
  pub fn add_preceding() {}

  pub fn add_preceding_start() {}

  pub fn add_preceding_end() {}

  // alias for add_following_end
  pub fn add_following() {}

  pub fn add_following_start() {}

  pub fn add_following_end() {}

  pub fn update_duration() {}

  pub fn remove_relationship() {}

  pub fn remove_relationships() {}
}
