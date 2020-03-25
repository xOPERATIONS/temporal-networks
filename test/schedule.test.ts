import { install, Interval, Schedule, Episode } from "../tmp";

describe("Interval", () => {
  beforeAll(install);

  it("can be instantiated", () => {
    const i = new Interval(0, 0);
    expect(i).toBeDefined();
  });

  it("can be indexed", () => {
    const lower = 1;
    const upper = 20.1;
    const i = new Interval(lower, upper);
    expect(i[0]).toEqual(lower);
    expect(i[1]).toEqual(upper);
  });

  it("can be compared for contains", () => {
    const i = new Interval(1, 9);
    expect(i.contains(4)).toEqual(true);
    expect(i.contains(10)).toEqual(false);
  });

  it("can be unioned", () => {
    const i1 = new Interval(1, 9);
    const i2 = new Interval(3, 4);
    const i3 = i1.union(i2);
    expect(i3.lower()).toEqual(3);
    expect(i3.upper()).toEqual(4);
  })

  it("has an upper and lower", () => {
    const lower = 10.1;
    const upper = 15.5;
    const i = new Interval(lower, upper);
    expect(i.lower()).toEqual(lower);
    expect(i.upper()).toEqual(upper);
  });

  it("can be checked for validity", () => {
    const i = new Interval(9, 7);
    expect(i.isValid()).toEqual(false);
  });

  it("can handle infinity as Number.MAX_VALUE", () => {
    let i = new Interval(0, Number.MAX_VALUE);
    expect(i.isValid()).toEqual(true);

    i = new Interval(0, Number.MAX_VALUE);
    expect(i.toJSON()).toEqual([0, Number.MAX_VALUE]);
    expect(i.contains(-1)).toEqual(false);

    // check 10 random positive floats against [0, inf]
    for (let j = 0; j < 10; j++) {
      const anyPossiblePosF64 = Math.random() * Number.MAX_VALUE;
      expect(i.contains(anyPossiblePosF64)).toEqual(true);
    }

    i = new Interval(-Number.MAX_VALUE, 0);
    expect(i.isValid()).toEqual(true);
    expect(i.contains(1)).toEqual(false);

    // check 10 random negative floats against [-inf, 0]
    for (let j = 0; j < 10; j++) {
      const anyPossibleNegF64 = -Math.random() * Number.MAX_VALUE;
      expect(i.contains(anyPossibleNegF64)).toEqual(true);
    }

    i = new Interval(-Number.MAX_VALUE, Number.MAX_VALUE);
    expect(i.isValid()).toEqual(true);

    // check 10 random floats against [-inf, inf]
    for (let j = 0; j < 10; j++) {
      const anyPossibleF64 =
        Math.random() * Number.MAX_VALUE * (Math.random() > 0.5 ? 1 : -1);
      expect(i.contains(anyPossibleF64)).toEqual(true);
    }
  });
});

describe("Schedule", () => {
  beforeAll(install);

  it("should create a episode without a duration", () => {
    const schedule = new Schedule();
    const episode = schedule.addEpisode();

    expect(episode instanceof Episode).toEqual(true);
    expect(schedule.getDuration(episode).toJSON()).toEqual([0, 0]);
  });

  it("should create a episode with a duration", () => {
    const testDuration = [15, 20];
    const schedule = new Schedule();
    const episode = schedule.addEpisode(new Float64Array(testDuration));
    expect(episode).toBeDefined();

    const i = schedule.getDuration(episode);
    expect(i.toJSON()).toEqual(testDuration);
  });

  it("should chain episodes together", () => {
    const schedule = new Schedule();
    const testDuration = [1, 5];
    const episode = schedule.addEpisode(new Float64Array(testDuration));
    const episode2 = schedule.addEpisode(new Float64Array([2, 9]));
    schedule.addConstraint(episode.end, episode2.start);

    expect(
      schedule.interval(episode.start, episode2.start).toJSON()
    ).toEqual(testDuration);
  });

  it("should provide intervals between episodes", () => {
    const schedule = new Schedule();
    const episode = schedule.addEpisode(new Float64Array([1, 5]));
    const episode2 = schedule.addEpisode(new Float64Array([2, 9]));
    const episode3 = schedule.addEpisode(new Float64Array([0, 10]));
    schedule.addConstraint(episode.end, episode2.start);
    schedule.addConstraint(episode2.end, episode3.start);

    expect(
      schedule.interval(episode.end, episode3.start).toJSON()
    ).toEqual([2, 9]);
  });

  it("should allow access to the first event", () => {
    const schedule = new Schedule();
    const episode = schedule.addEpisode(new Float64Array([1, 5]));
    const episode2 = schedule.addEpisode(new Float64Array([2, 9]));
    const episode3 = schedule.addEpisode(new Float64Array([0, 10]));
    schedule.addConstraint(episode.end, episode2.start);
    schedule.addConstraint(episode2.end, episode3.start);

    // the start of episode is the first event in the Schedule
    expect(schedule.root).toEqual(
      episode.start,
    );

    const expected = [3, 14];
    expect(
      schedule.interval(schedule.root, episode3.start).toJSON()
    ).toEqual(expected);
  });

  it("should let you perform greedy scheduling", () => {
    const schedule = new Schedule();
    const episode1 = schedule.addEpisode(new Float64Array([1, 5]));
    const episode2 = schedule.addEpisode(new Float64Array([2, 9]));
    const episode3 = schedule.addEpisode(new Float64Array([0, 10]));
    schedule.addConstraint(episode1.end, episode2.start);
    schedule.addConstraint(episode2.end, episode3.start);

    schedule.commitEvent(episode1.start, 0);
    schedule.commitEvent(episode1.end, 3);

    const expected1 = [5, 12];
    expect(schedule.window(episode2.end).toJSON()).toEqual(expected1);

    schedule.commitEvent(episode2.start, 3);
    schedule.commitEvent(episode2.end, 10);

    const expected2 = [10, 20];
    expect(schedule.window(episode3.end).toJSON()).toEqual(expected2);
  });

  it("doesn't barf if you miss the execution window", () => {
    const schedule = new Schedule();
    const episode1 = schedule.addEpisode(new Float64Array([1, 5]));
    const episode2 = schedule.addEpisode(new Float64Array([2, 9]));
    schedule.addConstraint(episode1.end, episode2.start);

    schedule.commitEvent(episode1.start, 0);
    schedule.commitEvent(episode1.end, 6);

    // still tries to keep the start in the right window
    const expected1 = [8, 14];
    expect(schedule.window(episode2.end).toJSON()).toEqual(expected1);
  });
});

describe("examples", () => {
  beforeAll(install);

  describe("from STNs for EVAs", () => {
    const buildExample = () => {
      const schedule = new Schedule();
      const X0 = schedule.createEvent();
      const L = schedule.addEpisode(new Float64Array([30, 40]));
      const S = schedule.addEpisode(new Float64Array([40, 50]));
      schedule.addConstraint(X0, L.start, new Float64Array([10, 20]));
      schedule.addConstraint(X0, S.end, new Float64Array([60, 70]));
      schedule.addConstraint(S.start, L.end, new Float64Array([10, 20]));
      schedule.compile();
      return { schedule, X0, L, S };
    };

    it("should report correct implicit intervals", () => {
      const { schedule, X0, L, S } = buildExample();
      // Ls to Ss upper
      expect(schedule.eventDistance(L.start, S.start)).toEqual(20);

      // Ls to Ss lower
      expect(schedule.eventDistance(S.start, L.start)).toEqual(-10);

      // Ls to Se upper
      expect(schedule.eventDistance(L.start, S.end)).toEqual(60);

      // Ls to Se lower
      expect(schedule.eventDistance(S.end, L.start)).toEqual(-50);

      // X0 to Le upper
      expect(schedule.eventDistance(X0, L.end)).toEqual(50);

      // X0 to Le lower
      expect(schedule.eventDistance(L.end, X0)).toEqual(-40);

      // X0 to Ss upper
      expect(schedule.eventDistance(X0, S.start)).toEqual(30);

      // X0 to Ss lower
      expect(schedule.eventDistance(S.start, X0)).toEqual(-20);
    });

    it("should give sane time stats", () => {
      const { schedule, X0, L, S } = buildExample();

      const explicitInterval = [10, 20];
      expect(schedule.interval(X0, L.start).toJSON()).toEqual(explicitInterval);

      const implicitInterval = [40, 50];
      expect(schedule.interval(X0, L.end).toJSON()).toEqual(implicitInterval);
    });
  });

  describe("from MIT 16.412 L02 slide 76", () => {
    const buildExample = () => {
      const schedule = new Schedule();
      const A = schedule.createEvent();
      const B = schedule.createEvent();
      const C = schedule.createEvent();
      const D = schedule.createEvent();
      schedule.addConstraint(A, B, new Float64Array([1, 10]));
      schedule.addConstraint(A, C, new Float64Array([0, 9]));
      schedule.addConstraint(B, D, new Float64Array([1, 1]));
      schedule.addConstraint(C, D, new Float64Array([2, 2]));
      return { schedule, A, B, C, D };
    };

    it("reports correct implicit intervals", () => {
      const { schedule, A, B, C, D } = buildExample();

      expect(schedule.interval(C, B).toJSON()).toEqual([1, 1]);
      expect(schedule.interval(A, D).toJSON()).toEqual([2, 11]);
    });

    it("can find the first episode", () => {
      const { schedule, A } = buildExample();
      expect(schedule.root).toEqual(A);
    });
  });

  describe("branching example", () => {
    /*
    Testing this type of structure, which reflects the step, substep relationship:

        ttttt     ttttt     ttttt     ttttt      <-(actor 1)
       /     \   /     \   /     \   /     \
    s-a-------a-a-------a-a-------a-a-------a-e
    |  \     /   \     /   \     /   \     /  |
    |   ttttt     ttttt     ttttt     ttttt   |  <-(actor 2)
    |_________________________________________|
              (limiting consumable)
    */

    it('calculates sane start and end times with a single branch and no slack', () => {
      /*
               Cs--[2, 3]--Ce
       [0, 0] /              \ [0, 0]
             Ps----[1, 5]----Pe
      */
      const schedule = new Schedule();

      const parent = schedule.addEpisode(new Float64Array([1, 5]));
      const child = schedule.addEpisode(new Float64Array([2, 3]));

      schedule.addConstraint(parent.start, child.start, new Float64Array([0, 0]));
      schedule.addConstraint(child.end, parent.end, new Float64Array([0, 0]));

      const parentActual = schedule.interval(parent.start, parent.end).toJSON();
      const childActual = schedule.interval(child.start, child.end).toJSON();

      // you would expect the interval for both parent and child to be their union
      expect(parentActual).toEqual([2, 3]);
      expect(childActual).toEqual([2, 3]);
    });

    it('calculates sane start and end times with a single branch and infinite slack', () => {
      /*
               Cs--[2, 3]--Ce
       [0, ∞] /              \ [0, ∞]
             Ps----[1, 5]----Pe
      */
      const schedule = new Schedule();

      const parent = schedule.addEpisode(new Float64Array([1, 5]));
      const child = schedule.addEpisode(new Float64Array([2, 3]));

      schedule.addConstraint(parent.start, child.start, new Float64Array([0, Number.MAX_VALUE]));
      schedule.addConstraint(child.end, parent.end, new Float64Array([0, Number.MAX_VALUE]));

      const parentActual = schedule.interval(parent.start, parent.end).toJSON();
      const childActual = schedule.interval(child.start, child.end).toJSON();

      // you would expect the parent interval to be truncated
      expect(parentActual).toEqual([2, 5]);
      expect(childActual).toEqual([2, 3]);
    });

    it('allows the child to have a longer duration than the parent (even though this is a problem)', () => {
      /*
               Cs--[5, 7]--Ce
       [0, 0] /              \ [0, 0]
             Ps----[1, 3]----Pe
      */
      const schedule = new Schedule();

      const parent = schedule.addEpisode(new Float64Array([1, 3]));
      const child = schedule.addEpisode(new Float64Array([5, 7]));

      schedule.addConstraint(parent.start, child.start, new Float64Array([0, 0]));
      schedule.addConstraint(child.end, parent.end, new Float64Array([0, 0]));

      const parentActual = schedule.interval(parent.start, parent.end).toJSON();
      const childActual = schedule.interval(child.start, child.end).toJSON();

      // note the reversed intervals. they basically swapped parent<->child!
      // this will need to be avoided in Step
      expect(parentActual).toEqual([5, 1]);
      expect(childActual).toEqual([5, 3]);
    });

    it('gives a reasonable execution window with a single branch and no slack', () => {
      /*
               Cs--[2, 3]--Ce
       [0, 0] /              \ [0, 0]
             Ps----[1, 5]----Pe
      */
      const schedule = new Schedule();

      const parent = schedule.addEpisode(new Float64Array([1, 5]));
      const child = schedule.addEpisode(new Float64Array([2, 3]));

      schedule.addConstraint(parent.start, child.start, new Float64Array([0, 0]));
      schedule.addConstraint(child.end, parent.end, new Float64Array([0, 0]));
      schedule.commitEvent(parent.start, 0.);

      const childWindow = schedule.window(child.start).toJSON();

      expect(childWindow).toEqual([0, 0]);
    });

    it('gives a reasonable execution window with a single branch and slack at the end', () => {
      /*
               Cs--[2, 3]--Ce
       [0, 0] /              \ [0, ∞]
             Ps----[1, 5]----Pe
      */
      const schedule = new Schedule();

      const parent = schedule.addEpisode(new Float64Array([1, 5]));
      const child = schedule.addEpisode(new Float64Array([2, 3]));

      schedule.addConstraint(parent.start, child.start, new Float64Array([0, 0]));
      schedule.addConstraint(child.end, parent.end, new Float64Array([0, Number.MAX_VALUE]));
      schedule.commitEvent(parent.start, 0.);

      const childWindow = schedule.window(child.start).toJSON();

      expect(childWindow).toEqual([0, 0]);
    });

    it('gives a reasonable execution window with an infinite parent and slack at the end', () => {
      /*
               Cs--[2, 3]--Ce
       [0, 0] /              \ [0, ∞]
             Ps----[0, ∞]----Pe
      */
      const schedule = new Schedule();

      const parent = schedule.addEpisode(new Float64Array([0, Number.MAX_VALUE]));
      const child = schedule.addEpisode(new Float64Array([2, 3]));

      schedule.addConstraint(parent.start, child.start, new Float64Array([0, 0]));
      schedule.addConstraint(child.end, parent.end, new Float64Array([0, Number.MAX_VALUE]));
      schedule.commitEvent(parent.start, 0.);

      const childWindow = schedule.window(child.start).toJSON();

      expect(childWindow).toEqual([0, 0]);
    });

    it('gives a reasonable execution window with an infinite parent, multiple children, and slack at the end', () => {
      /*
               C1s--[2, 3]--C1e--[0, 0]--C2s--[1, 9]--C2e
       [0, 0] /                                         \ [0, ∞]
             Ps------------------[0, ∞]------------------Pe
      */
      const schedule = new Schedule();

      const parent = schedule.addEpisode(new Float64Array([0, Number.MAX_VALUE]));
      const child1 = schedule.addEpisode(new Float64Array([2, 3]));
      const child2 = schedule.addEpisode(new Float64Array([1, 9]));

      schedule.addConstraint(parent.start, child1.start, new Float64Array([0, 0]));
      schedule.addConstraint(child1.end, child2.start, new Float64Array([0, 0]));
      schedule.addConstraint(child2.end, parent.end, new Float64Array([0, Number.MAX_VALUE]));
      schedule.commitEvent(parent.start, 0.);

      const child1Window = schedule.window(child1.start).toJSON();
      const child2Window = schedule.window(child2.start).toJSON();

      expect(child1Window).toEqual([0, 0]);
      expect(child2Window).toEqual([2, 3]);
    });
  });

  describe("from STS 134 summary", () => {
    const buildExample = (uncertainty = 0.0) => {
      const interval = ([lower, upper]) => new Float64Array([lower - uncertainty * lower, upper + uncertainty * upper]);

      const schedule = new Schedule();
      // make up an 8 hour lim cons
      const limCons = schedule.addEpisode(interval([0, 480]));

      // high level activities
      const egress = schedule.addEpisode(interval([40, 50]));
      const misse7 = schedule.addEpisode(interval([55, 65]));

      // string together the activities in series
      schedule.addConstraint(limCons.start, egress.start);
      schedule.addConstraint(egress.end, misse7.start);

      // the last activity needs to end before the limiting consumable is gone
      schedule.addConstraint(
        misse7.end,
        limCons.end,
        interval([0, Number.MAX_VALUE])
      );
      schedule.addConstraint(
        misse7.end,
        limCons.end,
        interval([0, Number.MAX_VALUE])
      );

      // define the tasks for each EV within each activity

      // EGRESS/SETUP tasks
      const ev1Egress = schedule.addEpisode(interval([10, 20]));
      const ev1Setup = schedule.addEpisode(interval([0, Number.MAX_VALUE]));
      const ev2Egress = schedule.addEpisode(interval([40, 50]));
      // EV1, EV2 egress in parallel but may not start at the same time
      schedule.addConstraint(egress.start, ev1Egress.start);
      schedule.addConstraint(ev1Egress.end, ev1Setup.start);
      schedule.addConstraint(
        egress.start,
        ev2Egress.start,
        interval([0, Number.MAX_VALUE])
      );
      // the activity ends when both EVs finish their egress
      schedule.addConstraint(egress.end, ev1Setup.end);
      schedule.addConstraint(egress.end, ev2Egress.end);

      // MISSE7 tasks
      const ev1MISSE7 = schedule.addEpisode(interval([55, 65]));
      const ev2MISSE7 = schedule.addEpisode(interval([55, 65]));
      // EV1, EV2 perform MISSE7 in parallel
      schedule.addConstraint(misse7.start, ev1MISSE7.start);
      schedule.addConstraint(misse7.start, ev2MISSE7.start);
      schedule.addConstraint(ev1MISSE7.end, misse7.end);
      schedule.addConstraint(ev2MISSE7.end, misse7.end);

      // const ev1MISSE8 = schedule.addEpisode(
      //   "EV1 performing MISSE 8 Install",
      //   interval([40, 40])
      // );
      // const ev2CETA = schedule.addEpisode(
      //   "EV2 performing S3 CETA Light Install",
      //   interval([25, 25])
      // );
      // const ev2SARJ = schedule.addEpisode(
      //   "EV2 performing Stbd SARJ Cover 7 Install",
      //   interval([25, 25])
      // );
      // const ev1P3P4NH3Install = schedule.addEpisode(
      //   "EV1 performing P3/P4 NH3 Jumper Install",
      //   interval([35, 35])
      // );
      // const ev2P3P4NH3Install = schedule.addEpisode(
      //   "EV2 performing P3/P4 NH3 Jumper Install",
      //   interval([25, 25])
      // );
      // // connect to the last sync edge
      // schedule.addConstraint(ev1MISSE7.end, ev1MISSE8.start);
      // schedule.addConstraint(ev2MISSE7.end, ev2CETA.start);

      // schedule.addConstraint(ev1MISSE8.end, ev1P3P4NH3Install.start);
      // schedule.addConstraint(ev2CETA.end, ev2SARJ.start);
      // schedule.addConstraint(ev2SARJ.end, ev2P3P4NH3Install.start);
      // // sync edge
      // schedule.addConstraint(
      //   ev1P3P4NH3Install.end,
      //   ev2P3P4NH3Install.end,
      //   interval([10, 10])
      // );

      // const ev1P5P6NH3Vent = schedule.addEpisode(
      //   "EV1 performing P5/P6 NH3 Jumper Install / N2 Vent",
      //   interval([35, 35])
      // );
      // const ev2P3P4NH3TempStow = schedule.addEpisode(
      //   "EV2 performing P3/P4 NH3 Jumper Temp Stow",
      //   interval([35, 35])
      // );
      // const ev1EWC = schedule.addEpisode(
      //   "EV1 performing EWC Antenna Install",
      //   interval([140, 140])
      // );
      // const ev2EWC = schedule.addEpisode(
      //   "EV2 performing EWC Antenna Install",
      //   interval([165, 165])
      // );
      // // connect to the last sync edge
      // schedule.addConstraint(ev1P3P4NH3Install.end, ev1P5P6NH3Vent.start);
      // schedule.addConstraint(ev2P3P4NH3Install.end, ev2P3P4NH3TempStow.start);

      // schedule.addConstraint(ev1P5P6NH3Vent.end, ev1EWC.start);
      // schedule.addConstraint(ev2P3P4NH3TempStow.end, ev2EWC.start);
      // // sync edge
      // schedule.addConstraint(ev1EWC.end, ev2EWC.end, interval([10, 10]));

      // const ev1VTEB = schedule.addEpisode(
      //   "EV1 performing VTEB Cleanup",
      //   interval([25, 25])
      // );

      // const ev1Ingress = schedule.addEpisode(
      //   "EV1 performing Cleanup / Ingress",
      //   interval([30, 30])
      // );
      // const ev2Ingress = schedule.addEpisode(
      //   "EV2 performing Cleanup / Ingress",
      //   interval([30, 30])
      // );
      // // connect to last sync edge
      // schedule.addConstraint(ev1EWC.end, ev1VTEB.start);
      // schedule.addConstraint(ev2EWC.end, ev2Ingress.start);

      // schedule.addConstraint(ev1VTEB.end, ev1Ingress.start);

      // // sync edge (may not be necessary?)
      // schedule.addConstraint(ev1Ingress.end, ev2Ingress.end);

      // // make sure the EVA ends on time
      // schedule.addConstraint(ev1Ingress.end, limCons.end);
      // schedule.addConstraint(ev2Ingress.end, limCons.end);

      return {
        schedule,
        limCons,
        egress,
        ev1Egress,
        ev2Egress,
        misse7,
        ev1MISSE7,
        ev2MISSE7
        // ev1MISSE8,
        // ev2CETA,
        // ev2SARJ,
        // ev1P3P4NH3Install,
        // ev2P3P4NH3Install,
        // ev1P5P6NH3Vent,
        // ev2P3P4NH3TempStow,
        // ev1EWC,
        // ev2EWC,
        // ev1VTEB,
        // ev1Ingress,
        // ev2Ingress
      };
    };

    it("should compile", () => {
      const { schedule } = buildExample();
      expect(() => schedule.compile()).not.toThrow();
    });

    it("should know the start of LIM CONS is the Schedule root", () => {
      const { schedule, limCons } = buildExample();
      expect(schedule.root).toEqual(limCons.start);
      expect(
        schedule.interval(schedule.root, limCons.start).toJSON()
      ).toEqual([0, 0]);
    });

    it("should know that EGRESS happens immediately", () => {
      const {
        schedule,
        limCons,
        egress,
        ev1Egress,
        ev2Egress
      } = buildExample();
      // egress start
      expect(schedule.interval(limCons.start, egress.start).toJSON()).toEqual([0, 0]);
      // EV1 egress start
      expect(schedule.interval(limCons.start, ev1Egress.start).toJSON()).toEqual([0, 0]);
      // EV2 may start egress late
      expect(schedule.interval(limCons.start, ev2Egress.start).toJSON()).toEqual([0, 10]);
    });

    it("should know that MISSE7 INSTALL start needs to be synced", () => {
      const {
        schedule,
        limCons,
        misse7,
        ev1MISSE7,
        ev2MISSE7
      } = buildExample();
      const startMISSE7 = schedule
        .interval(ev1MISSE7.start, ev2MISSE7.start)
        .toJSON();
      expect(startMISSE7).toEqual([0, 0]);
    });
  });
});
