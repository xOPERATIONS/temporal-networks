/**
 * Running in the context of ./pkg after the wasm has been built
 */

const { Schedule, interval } = require("./index");

/** Step */
function Step(description = "", duration = [], parent = null, root = null) {
  let episode, schedule;
  if (!parent) {
    schedule = new Schedule();
    // represents the limiting consumable
    episode = schedule.addEpisode([0, Number.MAX_VALUE]);
  } else {
    // create a ref to the parent's schedule
    schedule = parent.schedule;
    // add this step
    episode = schedule.addEpisode(duration);
  }
  this.schedule = schedule;

  if (!root) {
    root = this;
  }

  // just let people access description
  this.description = description;

  const substeps = [];

  this.addEpisode = schedule.addEpisode;
  this.addConstraint = schedule.addConstraint;

  /** Creates a sync point in the EVA for all actors */
  this.createSync = (description, duration = []) => {
    if (parent) {
      // TODO: does this make sense in terms of naming?
      throw new Error("Cannot create a sync from a Step");
    }

    const sync = new Step(
      (description = description),
      (duration = duration),
      (parent = this),
      (root = root)
    );
    substeps.push(sync);
    return sync;
  };

  /** Get the Step as-planned duration */
  this.duration = () => {
    // turn list of substeps into a branch in the graph
    root.construct();
    // run APSP
    root.schedule.compile();
    return schedule.interval(episode.start, episode.end).toJSON();
  };

  this.root = () => schedule.root;

  /**
   * Build the substeps into a branch that looks like so
   * s      e
   *  \____/
   */
  this.construct = () => {
    if (substeps.length === 0) {
      return;
    }

    // chain substeps together
    substeps.forEach((substep, index) => {
      if (index === 0) {
        return;
      }
      const prevStep = substeps[index - 1];
      this.schedule.addConstraint(prevStep.end, substep.start);
    });

    // constraint between start of this step and the first substep
    this.schedule.addConstraint(episode.start, substeps[0].start);
    // constraint between end of the last substep and this step
    this.schedule.addConstraint(substeps[substeps.length - 1].end, episode.end);

    // recurse
    substeps.forEach(s => s.construct());
  };

  // this.createSubstep = duration => {
  //   const substep = this.addEpisode(duration);
  //   substeps.push(substep);
  //   return substep;
  // };

  // this.push = step => {
  //   substeps.push(step);
  // };

  this.splice = substeps.splice;

  /** Put a step right after this one */
  // this.join = step => {
  //   if (!parent) {
  //     throw new Error(
  //       "cannot join to a root step because a root step has no siblings"
  //     );
  //   }

  //   // TODO:
  //   // splice the step into the parent's substep array right after this step
  //   // delete it if it exists elsewhere

  //   // TODO: actually write out what this API usage looks like
  //   parent.splice(step);
  // };

  // this.timingInfo = () => {
  //   this.compile();
  // };
}
module.exports.Step = Step;

module.exports.Mission = function Mission() {
  return new Step();
};

module.exports.createSubstep = (parent, child, duration = []) => {
  //
};
