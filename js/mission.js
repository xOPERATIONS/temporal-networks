/**
 * Running in the context of ./pkg after the wasm has been built. We're using old-school JS function classes for compatibility purposes and to avoid transpiling
 */

const { Schedule, Interval } = require("./index");

/**
 * An action in an EVA timeline. Should not be created directly, rather use a `Mission` or an existing `Step` to create steps.
 */
class Step {
  /** Human readable description */
  description = "";
  /** duration of the episode represented by this step */
  duration = null;
  /** "extra" time before and after this step */
  slack = null;
  episode = null;
  schedule = null;
  branches = new Map();
  root = null;
  actor = null;

  constructor(
    description = "",
    duration = [0, Number.MAX_VALUE],
    slack = [[0, 0], [0, 0]],
    parent,
    root,
    actor
  ) {
    this.description = description;
    this.duration = duration;
    this.slack = slack;
    this.actor = actor;

    // handle parent, schedule references
    if (!parent) {
      this.schedule = new Schedule()
      // represents the limiting consumable
      this.episode = this.schedule.addEpisode([0, Number.MAX_VALUE]);
    } else {
      // create a ref to the parent's schedule
      this.schedule = parent.schedule;
      // add this step and create an episode
      this.episode = this.schedule.addEpisode(duration);
    }

    if (!root) {
      this.root = this;
      this.nullActor = new Actor("None");
    } else {
      this.root = root;
    }


    // referenced methods on schedule, root
    this.addEpisode = this.schedule.addEpisode;
    this.addConstraint = this.schedule.addConstraint;
  }

  /**
   * Update the amount of slack before or after this step
   */
  updateSlack(before = null, after = null) {
    if (before) {
      this.slack[0] = before;
    }
    if (after) {
      this.slack[1] = after;
    }
  };

  /**
   * Create an actor for the EVA
   */
  createActor(name) {
    const actor = new Actor(name);
    return actor;
  };

  /**
   * Create a step beneath this Mission/Step
   */
  createStep(description = "", duration = [], actor = null, slack) {
    let a = actor || this.root.nullActor;
    if (!this.branches.has(a)) {
      this.branches.set(a, []);
    }
    const step = new Step(description, duration, slack, this, this.root, a);
    this.branches.get(a).push(step);
    return step;
  };

  /**
   * Get the Step as-planned duration
   */
  plannedDuration() {
    // actually create branches in the graph
    this.root.construct();
    // run APSP
    this.root.schedule.compile();
    return this.schedule.interval(this.episode.start, this.episode.end).toJSON();
  };

  /**
   * Build the substeps into a branch that looks like so
   *
   *              s------e
   *      [0, INF] \____/ [0, INF]
   *
   * Note that there is "slack" between the first and last substeps and the main step. Slack between substeps is unioned
   */
  construct() {
    if (this.branches.size === 0) {
      return;
    }
    // chain substeps in branches together
    for (const [a, substeps] of this.branches.entries()) {
      substeps.forEach((substep, index) => {
        if (index === 0) {
          return;
        }
        const prevStep = substeps[index - 1];
        const slack = (new Interval(...prevStep.slack[1])).union(new Interval(...substep.slack[0])).toJSON();
        this.schedule.addConstraint(prevStep.end, substep.start, slack);
      });
      // constraint between start of this step and the first substep
      this.schedule.addConstraint(this.episode.start, substeps[0].start, [0, Number.MAX_VALUE]);
      // constraint between end of the last substep and this step
      this.schedule.addConstraint(
        // allow for any amount of time between the last substep and this step
        substeps[substeps.length - 1].end, this.episode.end, [0, Number.MAX_VALUE]);
      // recurse
      substeps.forEach(s => s.construct());
    }
  };
}

module.exports.Step = Step;

module.exports.Mission = function Mission() {
  return new Step();
};

/**
 * An actor in the timeline.
 */
class Actor {
  name = null;
  constructor(name = "") {
    this.name = name;
  }
}
module.exports.Actor = Actor;
