/**
 * Running in the context of ./pkg after the wasm has been built
 */

const { Schedule } = require("./index");

/** Step */
function Step(description = "", duration = [], parent = null) {
  let episode, schedule;
  if (!parent) {
    schedule = new Schedule();
    // represents the limiting consumable
    episode = schedule.addEpisode([0, Number.MAX_VALUE]);
  } else {
    // create a ref to the parent's schedule
    schedule = parent.schedule;
    // add this step
    episode = parent.addEpisode(duration);
  }
  this.schedule = schedule;

  const substeps = [];

  this.addEpisode = schedule.addEpisode;
  this.addConstraint = schedule.addConstraint;

  this.root = () => schedule.root;

  this.createSubstep = duration => {
    const substep = this.addEpisode(duration);
    substeps.push(substep);
    return substep;
  };

  this.push = step => {
    substeps.push(step);
  };

  this.splice = substeps.splice;

  /** Put a step right after this one */
  this.join = step => {
    if (!parent) {
      throw new Error(
        "cannot join to a root step because a root step has no siblings"
      );
    }

    // TODO:
    // splice the step into the parent's substep array right after this step
    // delete it if it exists elsewhere

    // TODO: actually write out what this API usage looks like
    parent.splice(step);
  };

  this.compile = () => {
    // s    e
    // \____/
    // compile all the substeps into a chain of episodes with a constraint for the start of this episode to the start of the first epsidode, and the end of the last episode to the end of the this episode
    // recurse
  };

  this.timingInfo = () => {
    this.compile();
  };
}
module.exports.Step = Step;

module.exports.Mission = function Mission() {
  return new Step();
};

module.exports.createSubstep = (parent, child, duration = []) => {
  //
};
