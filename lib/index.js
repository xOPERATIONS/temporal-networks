/**
 * Running in the context of ./pkg after the wasm has been built. This file gets copied into the JS that wasm-pack generates
 */

/** An interval for a Step that does not have a time requirement */
const ANYTIME_INTERVAL = [0, Number.MAX_VALUE];
module.exports.ANYTIME_INTERVAL = ANYTIME_INTERVAL;

/**
 * An action in an EVA timeline. Should not be created directly, rather use a `Mission` or an existing `Step` to call `createStep` to create a new Step.
 *
 * Steps are meant to branch and converge into a linear structure. Each branch represents the actions being taken by an actor. For example, using `s` to represent the start of the Mission, `e` to represent the end, `a` to represent an activity, and `t` to represent a task, a two-actor Mission would be graphed as:
 *
 * ```
 *     ttttt     ttttt     ttttt     ttttt      <-(actor 1)
 *    /     \   /     \   /     \   /     \
 * s-a-------a-a-------a-a-------a-a-------a-e
 * |  \     /   \     /   \     /   \     /  |
 * |   ttttt     ttttt     ttttt     ttttt   |  <-(actor 2)
 * |_________________________________________|
 *           (limiting consumable)
 * ```
 *
 * Here you would call the series of `a`s substeps of the start and end, while each sequence of `t`s would be substeps of their parent `a`s. Substeps can be infinitely nested, eg. each `t` could have its own substeps in the form of `s` subtasks:
 *
 * ```
 *   sssss    <-(actor 1)
 *  /     \
 * t-------t
 *  \     /
 *   sssss    <-(actor 2)
 * ```
 *
 * Note that in the first example above, each activity has a start and end node. The same is true for tasks, as shown in the second example. In fact, all Steps have a definite start and end node. The methods in this class automatically handle start and end nodes for you.
 */
class Step {
  /** Human readable description */
  description = "";
  /** duration of the episode represented by this step */
  duration = [0, Number.MAX_VALUE];
  /** "extra" time interval [before, after] this step. This allows wiggle room between steps. Defaults to no wiggle room */
  slack = [[0, 0], [0, 0]];
  /** the actual temporal network. only the root Mission should have a schedule. all other steps will reference the root's schedule */
  schedule = new Schedule();
  /** who is performing this step */
  actor = "";
  /** the parent Step to this */
  _parent = null;
  /** the root of the Mission */
  _root = null;
  /** a reference to the Episode representing this Step in the schedule */
  _episode = null;
  /** maps actors to substeps */
  _branches = new Map();
  // TODO: is this necessary? this would only prevent recompiling unnecessarily if the schedule is accidentally marked dirty while updating
  /** track whether or not any substeps have changed */
  _dirty = true;

  constructor(
    description = "",
    duration = [0, Number.MAX_VALUE],
    slack = [[0, 0], [0, 0]],
    /** typeof {Step} */
    parent = null,
    root = null,
    actor = null,
  ) {
    this.description = description;
    this.duration = duration;
    this.slack = slack;

    if (actor) {
      this.actor = actor;
    }

    if (parent) {
      this._parent = parent;
    }

    // handle parent, schedule references
    if (!this._parent) {
      // we'll use the existing this.schedule
      // represents the limiting consumable
      this._episode = this.schedule.addEpisode(ANYTIME_INTERVAL);
    } else {
      // replace our schedule with a ref to the parent's schedule
      this.schedule = parent.schedule;
      // add this step and create an episode
      this._episode = this.schedule.addEpisode(duration);
    }

    if (!root) {
      this._root = this;
    } else {
      this._root = root;
    }
  }

  /**
   * An event ID representing the start of this Step
   * @returns {number}
   */
  get start() {
    return this._episode.start;
  }

  /**
   * An event ID representing the end of this Step
   * @returns {number}
   */
  get end() {
    return this._episode.end;
  }

  /**
   * Print this step and substeps with associated intervals
   */
  debug() {
    // actually create branches in the graph
    this._root.construct();

    console.log(`${this.description} start (${this.start}) --[${this.plannedDuration()}]-- ${this.description} end (${this.end})`);

    this._branches.forEach((substeps, actor) => {
      const intervalToSubsteps = this._root.schedule.interval(this.start, substeps[0].start).toJSON();
      const intervalFromSubsteps = this._root.schedule.interval(substeps[substeps.length - 1].end, this.end).toJSON();

      console.log(
        `  --[${intervalToSubsteps}] (${actor.name}) ${
        substeps
          .map(s =>
            `${s.description} start (${s.start}) --[${this._root.schedule.interval(s.start, s.end).toJSON()}]-- ${s.description} end (${s.end})`
          )
          .join(' - ')} [${intervalFromSubsteps}]--`
      );
    })
  };

  /**
   * Mark this step as having been started at a known phased elapsed time (PET)
   * @param {number} pet The PET when this step was started
   */
  startedAt(pet) {
    this.schedule.commitEvent(this.start, pet);
  }

  /**
   * Mark this step as having been completed at a known phased elapsed time (PET)
   * @param {number} pet The PET when this step was completed
   */
  completedAt(pet) {
    this.schedule.commitEvent(this.end, pet);
  }

  /**
   * Remove this Step from the timeline. It may be reused elsewhere. Note that the substeps are popped along with the Step and will still fall under this Step after it gets replaced in the Mission
   */
  pop() {
    this.schedule.freeEpisode(this._episode);
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
   * Change the actor for this step
   * @param {string} actor
   */
  updateActor(actor) {
    // TODO: maybe move the substep to the same position in the other branch?
    this._parent.changeActor(this, actor);
  }

  /**
   * Change the actor a substep falls under. Appends the substep to the end of the list of existing substeps
   * @param {Step} substep
   * @param {string} actor
   */
  changeActor(substep, actor) {
    // break the constraints between the substep and any other steps
    // TODO: probably need to pop immediate siblings too?
    substep.pop();
    substep.actor = actor;

    const branch = this.getOrCreateBranch(actor);
    branch.push(substep);
    this.setOrCreateBranch(actor, branch);
  }

  /**
   * Move a Step in the timeline to a new position.
   * @param {Step} parent the new parent Step
   * @param {Step} child the Step to move
   * @param {number} position the 0-indexed position of the moved Step in the new branch
   * @param {string} actor the Step's actor (if the actor is changing)
   */
  reorderStep(parent, child, position, actor = null) {
    child.pop();
    // TODO: need to pop any immediate siblings too?

    let a = actor || child.actor;

    const branch = parent.getOrCreateBranch(a);

    if (branch.length <= position) {
      branch.push(child)
    } else {
      // TODO: is this right?
      branch.splice(position, child);
    }

    parent.setOrCreateBranch(a, branch);
  }

  /**
   * Get or create a branch for an actor
   * @param {string} actor
   * @returns {Step[]}
   */
  getOrCreateBranch(actor) {
    // make sure the actor's branch exists
    if (!this._branches.has(actor)) {
      // create a branch for the actor
      this._branches.set(actor, []);
    }
    return this._branches.get(actor);
  }

  /**
   * Change the list of substeps for a branch. If no branch exists for the actor, the branch will be created
   * @param {string} actor
   * @param {Step[]} substeps
   */
  setOrCreateBranch(actor, substeps) {
    this._branches.set(actor, substeps);
  }

  /**
   * Create a step beneath this Mission/Step. If no actor is provided, then the substep has the same actor
   * @param {string} description
   * @param {number[]} duration [lower, upper] interval duration
   * @param {string} actor
   * @param {number[][]} slack [before, after] interval slack
   */
  createStep(description = "", duration = [], actor = null, slack = [[0, 0], [0, 0]]) {
    let a = actor || this.actor;

    const step = new Step(description, duration, slack, this, this._root, a);

    const branch = this.getOrCreateBranch(a);
    branch.push(step);
    this.setOrCreateBranch(a, branch);

    return step;
  }

  /**
   * Append a substep to the end of the list for an actor
   * @param {Step} substep
   * @param {string} actor
   */
  pushSubstep(substep, actor) {
    //
  }

  /**
   * Get the Step as-planned duration as a [lower, upper] range
   */
  plannedDuration() {
    // actually create branches in the graph
    this._root.construct();
    return this.schedule.interval(this.start, this.end).toJSON();
  }

  /**
   * Get the planned start time for this step as a range of [earliest, latest]
   * @returns {number[]}
   */
  plannedStartWindow() {
    // actually create the graph
    this._root.construct();

    // get the start window for the start of this step
    return this.schedule.window(this.start).toJSON();
  }

  /**
   * Build the substeps into a branch that looks like so
   *
   *              s------e
   *        [0, 0] \____/ [0, ∞]
   *
   * Note that there is [0, ∞] "slack" between the last substep and the end of the step. Slack between substeps is unioned.
   * @throws {Error} if the duration of the substeps > duration of the parent. This is not impossible from a temporal networks perspective, but it is impossible in an EVA timeline
   */
  construct() {
    // TODO: use some kind of this.dirty to determine if this is necessary to run?
    for (const [a, substeps] of this._branches.entries()) {
      const minDuration = substeps.reduce((prev, curr) => {
        return prev + curr.duration[0];
      }, 0);

      if (minDuration > this.duration[1]) {
        throw new Error(`The minimum duration of substeps cannot exceed the max duration of this step | ${this.actor.name} ${this.description}: ${this.duration[1]} vs. substeps: ${minDuration}`);
      }

      // handle slack time between substeps
      if (substeps.length > 1) {
        substeps.forEach((substep, index) => {
          // we're creating constraints looking back to the previous substep, so there's nothing to do on the first substep
          if (index === 0) {
            return;
          }

          // create a constraint between two substeps. the constraint will follow the slack set on each substep
          const prevStep = substeps[index - 1];
          // TODO: add back
          // const slack = (new Interval(...prevStep.slack[1])).union(new Interval(...substep.slack[0])).toJSON();
          this.schedule.addConstraint(prevStep.end, substep.start);
        });
      }

      // create a constraint between start of this step and the first substep
      this.schedule.addConstraint(this.start, substeps[0].start);
      // constraint between end of the last substep and this step. allow for any amount of time between the last substep and the end of this step
      this.schedule.addConstraint(substeps[substeps.length - 1].end, this.end, ANYTIME_INTERVAL);

      // recurse through substeps
      substeps.forEach(s => s.construct());
    }
  };

  /**
   * Check the timeline for internal consistency with respect to parent<->child relationships. Returns issues found.
   * @returns {object[string[]]}
   */
  validate() {
    const ret = {
      errors: [],
      warnings: [],
    };

    for (const [a, substeps] of this._branches.entries()) {
      const minDuration = substeps.reduce((prev, curr) => {
        return prev + curr.duration[0];
      }, 0);
      const maxDuration = substeps.reduce((prev, curr) => {
        return prev + curr.duration[1];
      }, 0);

      if (minDuration > this.duration[1]) {
        ret.errors.push(`The minimum duration of substeps cannot exceed the max duration of this step | ${this.actor.name} ${this.description}: ${this.duration[1]} vs. substeps: ${minDuration}`);
      }

      if (maxDuration > this.duration[1]) {
        ret.warnings.push(`The maximum duration of substeps should not exceed the max duration of this step | ${this.actor.name} ${this.description}: ${this.duration[1]} vs. substeps: ${maxDuration}`);
      }

      // recurse through substeps
      const subrets = substeps.map(s => s.validate());
      ret.errors = ret.errors.concat(subrets.map(s => s.errors)).flat();
      ret.warnings = ret.warnings.concat(subrets.map(s => s.warnings)).flat();
    }

    return ret;
  };
}

module.exports.Step = Step;

const allActors = "ALL";

/**
 * Create a new Mission (which is just a special Step with sane defaults)
 * @returns {Step}
 */
module.exports.Mission = function Mission() {
  const mission = new Step('LIM_CONS', ANYTIME_INTERVAL);
  // ensure a 0-indexed PET
  mission.startedAt(0.);
  // create a branch for all children to live on
  mission.createStep("ALL", ANYTIME_INTERVAL, allActors);
  return mission;
};

/**
 * Append a task to the mission timeline
 * @param {Step} mission The mission
 * @param {string} actor A list of actors working on this step
 * @param {string} description
 * @param {number[]} duration [lower, upper] interval
 * @returns {Step}
 */
function appendTask(mission, actor, description, duration) {
  // the main line through all tasks
  const main = mission.getOrCreateBranch(allActors);

  if (main.length > 0) {
    // there are sync points
    const lastWrapper = main[main.length - 1];

    if (lastWrapper.getOrCreateBranch(actor).length === 0) {
      // the last sync point does not have a task for this actor so we should fill one in
      const task = lastWrapper.createStep(description, duration, actor);
      return task;
    }
  }

  // either the last sync point already has a task for this actor or no sync points have been created. create a new one
  const syncWrapper = mission.createStep(`MAIN__${description}`, ANYTIME_INTERVAL, allActors);
  const task = syncWrapper.createStep(description, duration, actor);
  return task;
}

module.exports.appendTask = appendTask;

/**
 * Get the sync points for a mission
 * @param {Step} mission
 * @returns {Step[]}
 */
function syncPoints(mission) {
  return mission.getOrCreateBranch(allActors);
}

module.exports.syncPoints = syncPoints;
