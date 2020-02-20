const { expect } = require("chai");
const wasm = require("../pkg");
const { install, Interval, Plan, Step } = wasm;

describe("temporal-networks", () => {
  before(() => {
    // not required but useful for debugging
    install();
  });

  it("should have importable WASM", () => {
    expect(wasm).to.be.ok;
  });

  describe("Interval", () => {
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
    it("should create a step with only an identifier", () => {
      const testName = "test";
      const plan = new Plan();
      const step = plan.addStep(testName);

      expect(step instanceof Step).to.be.true;
      expect(plan.getDuration(step).toJSON()).to.deep.equal([0, 0]);
      expect(step.name).to.equal(testName);
    });

    it("should create a step with a duration", () => {
      const testDuration = [15, 20];
      const plan = new Plan();
      const step = plan.addStep("test", (duration = testDuration));
      expect(step).to.be.ok;

      const i = plan.getDuration(step);
      expect(i.toJSON()).to.deep.equal(testDuration);
    });

    it("should chain steps together", () => {
      const plan = new Plan();
      const testDuration = [1, 5];
      const step = plan.addStep("test", (duration = testDuration));
      const step2 = plan.addStep("test2", (duration = [2, 9]));
      plan.addConstraint(step.end, step2.start);

      expect(plan.interval(step.start, step2.start).toJSON()).to.deep.equal(
        testDuration
      );
    });

    it("should provide intervals between steps", () => {
      const plan = new Plan();
      const step = plan.addStep("test", (duration = [1, 5]));
      const step2 = plan.addStep("test2", (duration = [2, 9]));
      const step3 = plan.addStep("test3", (duration = [0, 10]));
      plan.addConstraint(step.end, step2.start);
      plan.addConstraint(step2.end, step3.start);

      expect(plan.interval(step.end, step3.start).toJSON()).to.deep.equal([
        2,
        9
      ]);
    });

    it("should allow access to the first event", () => {
      const plan = new Plan();
      const step = plan.addStep("test", (duration = [1, 5]));
      const step2 = plan.addStep("test2", (duration = [2, 9]));
      const step3 = plan.addStep("test3", (duration = [0, 10]));
      plan.addConstraint(step.end, step2.start);
      plan.addConstraint(step2.end, step3.start);

      expect(plan.root).to.equal(
        step.start,
        "the start of step is the first event in the plan"
      );

      const expected = [3, 14];
      expect(plan.interval(plan.root, step3.start).toJSON()).to.deep.equal(
        expected
      );
    });
  });

  describe("examples", () => {
    describe("from STNs for EVAs", () => {
      const buildExample = () => {
        const plan = new Plan();
        const X0 = plan.createEvent("X0");
        const L = plan.addStep("L", (duration = [30, 40]));
        const S = plan.addStep("S", (duration = [40, 50]));
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

        expect(plan.eventDistance(L.start, S.end), "Ls to Se upper").to.equal(
          60
        );
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
        expect(plan.interval(X0, L.end).toJSON()).to.deep.equal(
          implicitInterval
        );
      });
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

    it("can find the first step", () => {
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
      const limCons = plan.addStep("LIM CONS", interval([0, 480]));

      // EGRESS/SETUP
      const ev1Egress = plan.addStep(
        "EV1 performing EGRESS/SETUP",
        interval([10, 20])
      );
      const ev3Egress = plan.addStep(
        "EV3 performing EGRESS/SETUP",
        interval([40, 50])
      );
      plan.addConstraint(limCons.start, ev1Egress.start);
      plan.addConstraint(limCons.start, ev3Egress.start);

      const ev1MISSE7 = plan.addStep(
        "EV1 performing MISSE 7 RETRIEVE",
        interval([55, 65])
      );
      const ev3MISSE7 = plan.addStep(
        "EV3 performing MISSE 7 RETRIEVE",
        interval([55, 65])
      );
      // note that starting MISSE7 requires both crew are both done with EGRESS
      plan.addConstraint(ev1Egress.end, ev1MISSE7.start);
      plan.addConstraint(ev1Egress.end, ev3MISSE7.start);
      plan.addConstraint(ev3Egress.end, ev3MISSE7.start);
      plan.addConstraint(ev3Egress.end, ev1MISSE7.start);

      plan.addConstraint(
        ev1MISSE7.end,
        limCons.end,
        interval([0, Number.MAX_VALUE])
      );
      plan.addConstraint(
        ev3MISSE7.end,
        limCons.end,
        interval([0, Number.MAX_VALUE])
      );

      // const ev1MISSE8 = plan.addStep(
      //   "EV1 performing MISSE 8 Install",
      //   interval([40, 40])
      // );
      // const ev3CETA = plan.addStep(
      //   "EV3 performing S3 CETA Light Install",
      //   interval([25, 25])
      // );
      // const ev3SARJ = plan.addStep(
      //   "EV3 performing Stbd SARJ Cover 7 Install",
      //   interval([25, 25])
      // );
      // const ev1P3P4NH3Install = plan.addStep(
      //   "EV1 performing P3/P4 NH3 Jumper Install",
      //   interval([35, 35])
      // );
      // const ev3P3P4NH3Install = plan.addStep(
      //   "EV3 performing P3/P4 NH3 Jumper Install",
      //   interval([25, 25])
      // );
      // // connect to the last sync edge
      // plan.addConstraint(ev1MISSE7.end, ev1MISSE8.start);
      // plan.addConstraint(ev3MISSE7.end, ev3CETA.start);

      // plan.addConstraint(ev1MISSE8.end, ev1P3P4NH3Install.start);
      // plan.addConstraint(ev3CETA.end, ev3SARJ.start);
      // plan.addConstraint(ev3SARJ.end, ev3P3P4NH3Install.start);
      // // sync edge
      // plan.addConstraint(
      //   ev1P3P4NH3Install.end,
      //   ev3P3P4NH3Install.end,
      //   interval([10, 10])
      // );

      // const ev1P5P6NH3Vent = plan.addStep(
      //   "EV1 performing P5/P6 NH3 Jumper Install / N2 Vent",
      //   interval([35, 35])
      // );
      // const ev3P3P4NH3TempStow = plan.addStep(
      //   "EV3 performing P3/P4 NH3 Jumper Temp Stow",
      //   interval([35, 35])
      // );
      // const ev1EWC = plan.addStep(
      //   "EV1 performing EWC Antenna Install",
      //   interval([140, 140])
      // );
      // const ev3EWC = plan.addStep(
      //   "EV3 performing EWC Antenna Install",
      //   interval([165, 165])
      // );
      // // connect to the last sync edge
      // plan.addConstraint(ev1P3P4NH3Install.end, ev1P5P6NH3Vent.start);
      // plan.addConstraint(ev3P3P4NH3Install.end, ev3P3P4NH3TempStow.start);

      // plan.addConstraint(ev1P5P6NH3Vent.end, ev1EWC.start);
      // plan.addConstraint(ev3P3P4NH3TempStow.end, ev3EWC.start);
      // // sync edge
      // plan.addConstraint(ev1EWC.end, ev3EWC.end, interval([10, 10]));

      // const ev1VTEB = plan.addStep(
      //   "EV1 performing VTEB Cleanup",
      //   interval([25, 25])
      // );

      // const ev1Ingress = plan.addStep(
      //   "EV1 performing Cleanup / Ingress",
      //   interval([30, 30])
      // );
      // const ev3Ingress = plan.addStep(
      //   "EV3 performing Cleanup / Ingress",
      //   interval([30, 30])
      // );
      // // connect to last sync edge
      // plan.addConstraint(ev1EWC.end, ev1VTEB.start);
      // plan.addConstraint(ev3EWC.end, ev3Ingress.start);

      // plan.addConstraint(ev1VTEB.end, ev1Ingress.start);

      // // sync edge (may not be necessary?)
      // plan.addConstraint(ev1Ingress.end, ev3Ingress.end);

      // // make sure the EVA ends on time
      // plan.addConstraint(ev1Ingress.end, limCons.end);
      // plan.addConstraint(ev3Ingress.end, limCons.end);

      return {
        plan,
        limCons,
        ev1Egress,
        ev3Egress,
        ev1MISSE7,
        ev3MISSE7
        // ev1MISSE8,
        // ev3CETA,
        // ev3SARJ,
        // ev1P3P4NH3Install,
        // ev3P3P4NH3Install,
        // ev1P5P6NH3Vent,
        // ev3P3P4NH3TempStow,
        // ev1EWC,
        // ev3EWC,
        // ev1VTEB,
        // ev1Ingress,
        // ev3Ingress
      };
    };

    it("should compile", () => {
      const { plan } = buildExample();
      expect(plan.compile).to.not.throw;
    });

    it("should know the start of LIM CONS is the plan root", () => {
      const { plan, limCons } = buildExample();
      expect(plan.root).to.equal(limCons.start);
    });

    it("should know that EGRESS happens immediately", () => {
      const { plan, ev1Egress, ev3Egress } = buildExample();
      expect(plan.interval(plan.root, ev1Egress.start).toJSON()).to.deep.equal([
        0,
        0
      ]);
      expect(plan.interval(plan.root, ev3Egress.start).toJSON()).to.deep.equal([
        0,
        0
      ]);
    });

    it.only("should know that MISSE7 INSTALL start needs to be synced", () => {
      const { plan, ev1MISSE7, ev3MISSE7 } = buildExample();
      const ev1StartMISSE7 = plan.interval(plan.root, ev1MISSE7.start).toJSON();
      const ev3StartMISSE7 = plan.interval(plan.root, ev3MISSE7.start).toJSON();
      expect(ev1StartMISSE7 === ev3StartMISSE7).to.be.true;
    });
  });
});
