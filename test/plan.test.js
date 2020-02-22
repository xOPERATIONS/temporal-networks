const { expect } = require("chai");
const { install, Interval, Plan, Period } = require("../pkg");

describe("Interval", () => {
  before(install);

  it("can be instantiated", () => {
    const i = new Interval(0, 0);
    expect(i).to.be.ok;
  });

  it("can be indexed", () => {
    const lower = 1;
    const upper = 20.1;
    const i = new Interval(lower, upper);
    expect(i[0]).to.equal(lower);
    expect(i[1]).to.equal(upper);
  });

  it("can be compared for contains", () => {
    const i = new Interval(1, 9);
    expect(i.contains(4)).to.be.true;
    expect(i.contains(10)).to.be.false;
  });

  it("has an upper and lower", () => {
    const lower = 10.1;
    const upper = 15.5;
    const i = new Interval(lower, upper);
    expect(i.lower()).to.equal(lower);
    expect(i.upper()).to.equal(upper);
  });

  it("can be checked for validity", () => {
    const i = new Interval(9, 7);
    expect(i.isValid()).to.be.false;
  });

  it("can handle infinity as Number.MAX_VALUE", () => {
    let i = new Interval(0, Number.MAX_VALUE);
    expect(i.isValid()).to.be.true;

    i = new Interval(0, Number.MAX_VALUE);
    expect(i.toJSON()).to.deep.equal([0, Number.MAX_VALUE]);
    expect(i.contains(-1)).to.be.false;

    // check 10 random positive floats against [0, inf]
    for (let j = 0; j < 10; j++) {
      const anyPossiblePosF64 = Math.random() * Number.MAX_VALUE;
      expect(i.contains(anyPossiblePosF64)).to.be.true;
    }

    i = new Interval(-Number.MAX_VALUE, 0);
    expect(i.isValid()).to.be.true;
    expect(i.contains(1)).to.be.false;

    // check 10 random negative floats against [-inf, 0]
    for (let j = 0; j < 10; j++) {
      const anyPossibleNegF64 = -Math.random() * Number.MAX_VALUE;
      expect(i.contains(anyPossibleNegF64)).to.be.true;
    }

    i = new Interval(-Number.MAX_VALUE, Number.MAX_VALUE);
    expect(i.isValid()).to.be.true;

    // check 10 random floats against [-inf, inf]
    for (let j = 0; j < 10; j++) {
      const anyPossibleF64 =
        Math.random() * Number.MAX_VALUE * (Math.random() > 0.5 ? 1 : -1);
      expect(i.contains(anyPossibleF64)).to.be.true;
    }
  });
});

describe("Plan", () => {
  before(install);

  it("should create a period with only an identifier", () => {
    const testName = "test";
    const plan = new Plan();
    const period = plan.addPeriod(testName);

    expect(period instanceof Period).to.be.true;
    expect(plan.getDuration(period).toJSON()).to.deep.equal([0, 0]);
    expect(period.name).to.equal(testName);
  });

  it("should create a period with a duration", () => {
    const testDuration = [15, 20];
    const plan = new Plan();
    const period = plan.addPeriod("test", (duration = testDuration));
    expect(period).to.be.ok;

    const i = plan.getDuration(period);
    expect(i.toJSON()).to.deep.equal(testDuration);
  });

  it("should chain periods together", () => {
    const plan = new Plan();
    const testDuration = [1, 5];
    const period = plan.addPeriod("test", (duration = testDuration));
    const period2 = plan.addPeriod("test2", (duration = [2, 9]));
    plan.addConstraint(period.end, period2.start);

    expect(plan.interval(period.start, period2.start).toJSON()).to.deep.equal(
      testDuration
    );
  });

  it("should provide intervals between periods", () => {
    const plan = new Plan();
    const period = plan.addPeriod("test", (duration = [1, 5]));
    const period2 = plan.addPeriod("test2", (duration = [2, 9]));
    const period3 = plan.addPeriod("test3", (duration = [0, 10]));
    plan.addConstraint(period.end, period2.start);
    plan.addConstraint(period2.end, period3.start);

    expect(plan.interval(period.end, period3.start).toJSON()).to.deep.equal([
      2,
      9
    ]);
  });

  it("should allow access to the first event", () => {
    const plan = new Plan();
    const period = plan.addPeriod("test", (duration = [1, 5]));
    const period2 = plan.addPeriod("test2", (duration = [2, 9]));
    const period3 = plan.addPeriod("test3", (duration = [0, 10]));
    plan.addConstraint(period.end, period2.start);
    plan.addConstraint(period2.end, period3.start);

    expect(plan.root).to.equal(
      period.start,
      "the start of period is the first event in the plan"
    );

    const expected = [3, 14];
    expect(plan.interval(plan.root, period3.start).toJSON()).to.deep.equal(
      expected
    );
  });

  it("should let you perform greedy scheduling", () => {
    const plan = new Plan();
    const period1 = plan.addPeriod("test", (duration = [1, 5]));
    const period2 = plan.addPeriod("test2", (duration = [2, 9]));
    const period3 = plan.addPeriod("test3", (duration = [0, 10]));
    plan.addConstraint(period1.end, period2.start);
    plan.addConstraint(period2.end, period3.start);

    plan.commitEvent(period1.start, 0);
    plan.commitEvent(period1.end, 3);

    const expected1 = [5, 12];
    expect(plan.window(period2.end).toJSON()).to.deep.equal(expected1);

    plan.commitEvent(period2.start, 3);
    plan.commitEvent(period2.end, 10);

    const expected2 = [10, 20];
    expect(plan.window(period3.end).toJSON()).to.deep.equal(expected2);
  });

  it("doesn't barf if you miss the execution window", () => {
    const plan = new Plan();
    const period1 = plan.addPeriod("test", (duration = [1, 5]));
    const period2 = plan.addPeriod("test2", (duration = [2, 9]));
    plan.addConstraint(period1.end, period2.start);

    plan.commitEvent(period1.start, 0);
    plan.commitEvent(period1.end, 6);

    // still tries to keep the start in the right window
    const expected1 = [8, 14];
    expect(plan.window(period2.end).toJSON()).to.deep.equal(expected1);
  });
});

describe("examples", () => {
  before(install);

  describe("from STNs for EVAs", () => {
    const buildExample = () => {
      const plan = new Plan();
      const X0 = plan.createEvent("X0");
      const L = plan.addPeriod("L", (duration = [30, 40]));
      const S = plan.addPeriod("S", (duration = [40, 50]));
      plan.addConstraint(X0, L.start, (interval = [10, 20]));
      plan.addConstraint(X0, S.end, (interval = [60, 70]));
      plan.addConstraint(S.start, L.end, (interval = [10, 20]));
      plan.compile();
      return { plan, X0, L, S };
    };

    it("should report correct implicit intervals", () => {
      const { plan, X0, L, S } = buildExample();
      expect(plan.eventDistance(L.start, S.start), "Ls to Ss upper").to.equal(
        20
      );
      expect(plan.eventDistance(S.start, L.start), "Ls to Ss lower").to.equal(
        -10
      );

      expect(plan.eventDistance(L.start, S.end), "Ls to Se upper").to.equal(60);
      expect(plan.eventDistance(S.end, L.start), "Ls to Se lower").to.equal(
        -50
      );

      expect(plan.eventDistance(X0, L.end), "X0 to Le upper").to.equal(50);
      expect(plan.eventDistance(L.end, X0), "X0 to Le lower").to.equal(-40);

      expect(plan.eventDistance(X0, S.start), "X0 to Ss upper").to.equal(30);
      expect(plan.eventDistance(S.start, X0), "X0 to Ss lower").to.equal(-20);
    });

    it("should give sane time stats", () => {
      const { plan, X0, L, S } = buildExample();

      const explicitInterval = [10, 20];
      expect(plan.interval(X0, L.start).toJSON()).to.deep.equal(
        explicitInterval
      );

      const implicitInterval = [40, 50];
      expect(plan.interval(X0, L.end).toJSON()).to.deep.equal(implicitInterval);
    });
  });

  describe("from MIT 16.412 L02 slide 76", () => {
    const buildExample = () => {
      const plan = new Plan();
      const A = plan.createEvent("A");
      const B = plan.createEvent("B");
      const C = plan.createEvent("C");
      const D = plan.createEvent("D");
      plan.addConstraint(A, B, (interval = [1, 10]));
      plan.addConstraint(A, C, (interval = [0, 9]));
      plan.addConstraint(B, D, (interval = [1, 1]));
      plan.addConstraint(C, D, (interval = [2, 2]));
      return { plan, A, B, C, D };
    };

    it("report correct implicit intervals", () => {
      const { plan, A, B, C, D } = buildExample();

      expect(plan.interval(C, B).toJSON()).to.deep.equal([1, 1]);
      expect(plan.interval(A, D).toJSON()).to.deep.equal([2, 11]);
    });

    it("can find the first period", () => {
      const { plan, A } = buildExample();
      expect(plan.root).to.equal(A);
    });
  });

  describe("from STS 134 summary", () => {
    const buildExample = (uncertainty = 0.0) => {
      const interval = ([lower, upper]) => [
        lower - uncertainty * lower,
        upper + uncertainty * upper
      ];

      const plan = new Plan();
      // make up an 8 hour lim cons
      const limCons = plan.addPeriod("LIM CONS", interval([0, 480]));

      // high level activities
      const egress = plan.addPeriod("EGRESS/SETUP", interval([40, 50]));
      const misse7 = plan.addPeriod("MISSE7", interval([55, 65]));

      // string together the activities in series
      plan.addConstraint(limCons.start, egress.start);
      plan.addConstraint(egress.end, misse7.start);

      // the last activity needs to end before the limiting consumable is gone
      plan.addConstraint(
        misse7.end,
        limCons.end,
        interval([0, Number.MAX_VALUE])
      );
      plan.addConstraint(
        misse7.end,
        limCons.end,
        interval([0, Number.MAX_VALUE])
      );

      // define the tasks for each EV within each activity

      // EGRESS/SETUP tasks
      const ev1Egress = plan.addPeriod(
        "EV1 performing EGRESS",
        interval([10, 20])
      );
      const ev1Setup = plan.addPeriod(
        "EV1 performing SETUP",
        interval([0, Number.MAX_VALUE])
      );
      const ev2Egress = plan.addPeriod(
        "EV2 performing EGRESS/SETUP",
        interval([40, 50])
      );
      // EV1, EV2 egress in parallel but may not start at the same time
      plan.addConstraint(egress.start, ev1Egress.start);
      plan.addConstraint(ev1Egress.end, ev1Setup.start);
      plan.addConstraint(
        egress.start,
        ev2Egress.start,
        interval([0, Number.MAX_VALUE])
      );
      // the activity ends when both EVs finish their egress
      plan.addConstraint(egress.end, ev1Setup.end);
      plan.addConstraint(egress.end, ev2Egress.end);

      // MISSE7 tasks
      const ev1MISSE7 = plan.addPeriod(
        "EV1 performing MISSE 7 RETRIEVE",
        interval([55, 65])
      );
      const ev2MISSE7 = plan.addPeriod(
        "EV2 performing MISSE 7 RETRIEVE",
        interval([55, 65])
      );
      // EV1, EV2 perform MISSE7 in parallel
      plan.addConstraint(misse7.start, ev1MISSE7.start);
      plan.addConstraint(misse7.start, ev2MISSE7.start);
      plan.addConstraint(ev1MISSE7.end, misse7.end);
      plan.addConstraint(ev2MISSE7.end, misse7.end);

      // const ev1MISSE8 = plan.addPeriod(
      //   "EV1 performing MISSE 8 Install",
      //   interval([40, 40])
      // );
      // const ev2CETA = plan.addPeriod(
      //   "EV2 performing S3 CETA Light Install",
      //   interval([25, 25])
      // );
      // const ev2SARJ = plan.addPeriod(
      //   "EV2 performing Stbd SARJ Cover 7 Install",
      //   interval([25, 25])
      // );
      // const ev1P3P4NH3Install = plan.addPeriod(
      //   "EV1 performing P3/P4 NH3 Jumper Install",
      //   interval([35, 35])
      // );
      // const ev2P3P4NH3Install = plan.addPeriod(
      //   "EV2 performing P3/P4 NH3 Jumper Install",
      //   interval([25, 25])
      // );
      // // connect to the last sync edge
      // plan.addConstraint(ev1MISSE7.end, ev1MISSE8.start);
      // plan.addConstraint(ev2MISSE7.end, ev2CETA.start);

      // plan.addConstraint(ev1MISSE8.end, ev1P3P4NH3Install.start);
      // plan.addConstraint(ev2CETA.end, ev2SARJ.start);
      // plan.addConstraint(ev2SARJ.end, ev2P3P4NH3Install.start);
      // // sync edge
      // plan.addConstraint(
      //   ev1P3P4NH3Install.end,
      //   ev2P3P4NH3Install.end,
      //   interval([10, 10])
      // );

      // const ev1P5P6NH3Vent = plan.addPeriod(
      //   "EV1 performing P5/P6 NH3 Jumper Install / N2 Vent",
      //   interval([35, 35])
      // );
      // const ev2P3P4NH3TempStow = plan.addPeriod(
      //   "EV2 performing P3/P4 NH3 Jumper Temp Stow",
      //   interval([35, 35])
      // );
      // const ev1EWC = plan.addPeriod(
      //   "EV1 performing EWC Antenna Install",
      //   interval([140, 140])
      // );
      // const ev2EWC = plan.addPeriod(
      //   "EV2 performing EWC Antenna Install",
      //   interval([165, 165])
      // );
      // // connect to the last sync edge
      // plan.addConstraint(ev1P3P4NH3Install.end, ev1P5P6NH3Vent.start);
      // plan.addConstraint(ev2P3P4NH3Install.end, ev2P3P4NH3TempStow.start);

      // plan.addConstraint(ev1P5P6NH3Vent.end, ev1EWC.start);
      // plan.addConstraint(ev2P3P4NH3TempStow.end, ev2EWC.start);
      // // sync edge
      // plan.addConstraint(ev1EWC.end, ev2EWC.end, interval([10, 10]));

      // const ev1VTEB = plan.addPeriod(
      //   "EV1 performing VTEB Cleanup",
      //   interval([25, 25])
      // );

      // const ev1Ingress = plan.addPeriod(
      //   "EV1 performing Cleanup / Ingress",
      //   interval([30, 30])
      // );
      // const ev2Ingress = plan.addPeriod(
      //   "EV2 performing Cleanup / Ingress",
      //   interval([30, 30])
      // );
      // // connect to last sync edge
      // plan.addConstraint(ev1EWC.end, ev1VTEB.start);
      // plan.addConstraint(ev2EWC.end, ev2Ingress.start);

      // plan.addConstraint(ev1VTEB.end, ev1Ingress.start);

      // // sync edge (may not be necessary?)
      // plan.addConstraint(ev1Ingress.end, ev2Ingress.end);

      // // make sure the EVA ends on time
      // plan.addConstraint(ev1Ingress.end, limCons.end);
      // plan.addConstraint(ev2Ingress.end, limCons.end);

      return {
        plan,
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
      const { plan } = buildExample();
      expect(plan.compile).to.not.throw;
    });

    it("should know the start of LIM CONS is the plan root", () => {
      const { plan, limCons } = buildExample();
      expect(plan.root).to.equal(limCons.start);
      expect(plan.interval(plan.root, limCons.start).toJSON()).to.deep.equal([
        0,
        0
      ]);
    });

    it("should know that EGRESS happens immediately", () => {
      const { plan, limCons, egress, ev1Egress, ev2Egress } = buildExample();
      expect(plan.interval(limCons.start, egress.start).toJSON()).to.deep.equal(
        [0, 0],
        "egress start"
      );
      expect(
        plan.interval(limCons.start, ev1Egress.start).toJSON()
      ).to.deep.equal([0, 0], "EV1 egress start");
      expect(
        plan.interval(limCons.start, ev2Egress.start).toJSON()
      ).to.deep.equal([0, 10], "EV2 may start egress late");
    });

    it("should know that MISSE7 INSTALL start needs to be synced", () => {
      const { plan, limCons, misse7, ev1MISSE7, ev2MISSE7 } = buildExample();
      const startMISSE7 = plan
        .interval(ev1MISSE7.start, ev2MISSE7.start)
        .toJSON();
      expect(startMISSE7).to.deep.equal([0, 0]);
    });
  });
});
