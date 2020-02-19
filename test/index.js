const { expect } = require("chai");
const wasm = require("../pkg");
const { Interval, Plan, Step } = wasm;

// taken from MIT 16.412 L02 (see docs/references/)
const example1 = {
  edges: [
    { source: 0, target: 1, interval: [1, 10] },
    { source: 0, target: 2, interval: [0, 9] },
    { source: 1, target: 3, interval: [1, 1] },
    { source: 2, target: 3, interval: [2, 2] }
  ]
};

const example2 = () => {
  const plan = new Plan();
};

describe("temporal-networks", () => {
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
  });

  describe("Plan", () => {
    it("should create a step with only an identifier", () => {
      const testName = "test";
      const plan = new Plan();
      const step = plan.addStep(testName);

      expect(step instanceof Step).to.be.true;
      expect(plan.getDuration(step).toJSON()).to.deep.equal([0, 0]);
      expect(step.toString()).to.equal(testName);
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
    describe("taken from STNs for EVAs", () => {
      function buildExample() {
        const plan = new Plan();
        const X0 = plan.createEvent("X0");
        const L = plan.addStep("L", (duration = [30, 40]));
        const S = plan.addStep("S", (duration = [40, 50]));
        plan.addConstraint(X0, L.start, (interval = [10, 20]));
        plan.addConstraint(X0, S.end, (interval = [60, 70]));
        plan.addConstraint(S.start, L.end, (interval = [10, 20]));
        plan.compile();
        return { plan, X0, L, S };
      }

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
});

//   it("should give high level statistics", () => {
//     const plan = new Plan();

//     expect(plan.getDuration()).to.equal([0, 0]);
//   });

//   it("should allow parallel steps", () => {
//     const plan = new Plan();

//     const root = plan.addStep();

//     // two steps in parallel; both start at the plan root
//     plan.addStep((follows = root), (duration = [4, 9]));
//     plan.addStep((follows = root), (duration = [5, 10]));

//     // union the intervals
//     expect(plan.getDuration()).to.equal([5, 9]);
//   });
