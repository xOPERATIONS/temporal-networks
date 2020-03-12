/**
 * Running in the context of ./pkg after the wasm has been built. We're using old-school JS function classes for compatibility purposes and to avoid transpiling
 */

const { Schedule, Interval } = require("./index");

/**
 * An action in an EVA timeline. Should not be created directly, rather use a `Mission` or an existing `Step` to call `createStep` to create a new Step.
 *
 * Steps are meant to branch and converge into a linear structure. For example, using `s` to represent the start of the Mission, `e` to represent the end, `a` to represent an activity, and `t` to represent a task:
 *
 * ```
 *     ttttt     ttttt     ttttt     ttttt
 *    /     \   /     \   /     \   /     \
 * s-a-------a-a-------a-a-------a-a-------a-e
 * |  \     /   \     /   \     /   \     /  |
 * |   ttttt     ttttt     ttttt     ttttt   |
 * |_________________________________________|
 *           (limiting consumable)
 * ```
 *
 * Here you would call the series of `a`s substeps of the start and end, while each sequence of `t`s would be substeps of their parent `a`s. Substeps can be infinitely nested, eg. each `t` could have its own substeps in the form of `s` subtasks:
 *
 * ```
 *   sssss
 *  /     \
 * t-------t
 *  \     /
 *   sssss
 * ```
 *
 * Note that in the example above, each activity has a start and end node. The same is true for tasks, or any substeps. The methods in this class automatically handle start and end nodes for you.
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
  actor = new Actor();
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
      this._episode = this.schedule.addEpisode([0, Number.MAX_VALUE]);
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
   * Set the duration
   * @param {number[]} duration
   */
  set duration(duration) {
    // TODO: I assume that petgraph.add_edge() in addConstraint is a create-or-update action
    this.schedule.addConstraint(this.episode.start, this.episode.end, duration);
    this.duration = duration;
  }

  /**
   * Remove this Step from the timeline. It may be reused elsewhere
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
   * Create an actor for the EVA
   * @param {string} name
   */
  createActor(name = "") {
    const actor = new Actor(name);
    return actor;
  };

  /**
   * Change the actor for this step
   * @param {Actor} actor
   */
  updateActor(actor) {
    // TODO: maybe move the substep to the same position in the other branch?
    this._parent.changeActor(this, actor);
  }

  /**
   * Change the actor a substep falls under. Appends the substep to the end of the list of existing substeps
   * @param {Step} substep
   * @param {Actor} actor
   */
  changeActor(substep, actor) {
    // break the constraints between the substep and any other steps
    substep.pop();

    const branch = this.getOrCreateBranch(actor);
    branch.push(substep);
    this.setOrCreateBranch(actor, branch);
  }

  /**
   * Move a Step in the timeline to a new position.
   * @param {Step} parent the new parent Step
   * @param {Step} child the Step to move
   * @param {number} position the 0-indexed position of the moved Step in the new branch
   * @param {Actor} actor the Step's actor (if the actor is changing)
   */
  reorderStep(parent, child, position, actor = null) {
    child.pop();

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
   * @param {Actor} actor
   * @returns {}
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
   * @param {Actor} actor
   * @param {Step[]} substeps
   */
  setOrCreateBranch(actor, substeps) {
    this._branches.set(actor, substeps);
  }

  /**
   * Create a step beneath this Mission/Step. If no actor is provided, then the substep has the same actor
   * @param {string} description
   * @param {number[]} duration [lower, upper] interval duration
   * @param {Actor} actor
   * @param {number[][]} slack [before, after] interval slack
   */
  createStep(description = "", duration = [], actor = null, slack = null) {
    let a = actor || this.actor;

    const step = new Step(description, duration, slack, this, this._root, a);

    const branch = this.getOrCreateBranch(a);
    branch.push(step);
    this.setOrCreateBranch(a, branch);

    this.dirty = true;
    return step;
  }

  /**
   * Append a substep to the end of the list for an actor
   * @param {Step} substep
   * @param {Actor} actor
   */
  pushSubstep(substep, actor) {
    //
  }

  /**
   * Get the Step as-planned duration
   */
  plannedDuration() {
    // actually create branches in the graph
    this._root.construct();
    // run APSP
    this._root.schedule.compile();
    return this.schedule.interval(this._episode.start, this._episode.end).toJSON();
  }

  /**
   * Get the planned start time for this step as a range of [earliest, latest]
   * @returns {number[]}
   */
  plannedStartRange() {
    // actually create the graph
    this._root.construct();
    // run APSP
    this._root.schedule.compile();

    // get the interval between the schedule root and this step's start
    return this.schedule.interval(this._root._episode.start, this._episode.start).toJSON();
  }

  /**
   * Build the substeps into a branch that looks like so
   *
   *              s------e
   *      [0, INF] \____/ [0, INF]
   *
   * Note that there is [0, INF] "slack" between the first and last substeps and the main step. Slack between substeps is unioned.
   */
  construct() {
    if (this._branches.size === 0) {
      return;
    }

    // chain substeps in branches together
    for (const [a, substeps] of this._branches.entries()) {
      substeps.forEach((substep, index) => {
        // we're creating constraints looking back to the previous substep, so there's nothing to do on the first substep
        if (index === 0) {
          return;
        }

        // create a constraint between two substeps. the constraint will follow the slack set on each substep
        const prevStep = substeps[index - 1];
        const slack = (new Interval(...prevStep.slack[1])).union(new Interval(...substep.slack[0])).toJSON();
        this.schedule.addConstraint(prevStep.end, substep.start, slack);
      });

      // create a constraint between start of this step and the first substep with any amount of time
      this.schedule.addConstraint(this._episode.start, substeps[0].start, [0, Number.MAX_VALUE]);
      // constraint between end of the last substep and this step. allow for any amount of time between the last substep and this step
      this.schedule.addConstraint(substeps[substeps.length - 1].end, this._episode.end, [0, Number.MAX_VALUE]);

      // recurse through substeps
      substeps.forEach(s => s.construct());
    }
  };
}

module.exports.Step = Step;

/**
 * Create a new Mission (which is just a special kind of Step)
 * @returns {Step}
 */
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
