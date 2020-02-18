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
      const step = plan.addStep("test", (duration = [1, 5]));
      const step2 = plan.addStep("test2", (duration = [2, 9]));
      plan.addConstraint(step.end, step2.start);

      expect(plan.timeUntil(step2.start)).to.equal(5);
    });

    it("should provide intervals between steps", () => {
      const plan = new Plan();
      const step = plan.addStep("test", (duration = [1, 5]));
      const step2 = plan.addStep("test2", (duration = [2, 9]));
      const step3 = plan.addStep("test3", (duration = [0, 10]));

      plan.addConstraint(step.end, step2.start);
      plan.addConstraint(step2.end, step3.start);

      expect(plan.intervalBetween(step, step3).toJSON()).to.deep.equal([3, 14]);
    });
  });
});

//   it("should give high level statistics", () => {
//     const plan = new Plan();

//     expect(plan.getDuration()).to.equal([0, 0]);
//   });

//   it("should compose steps", () => {
//     // no duration given to the plan, so no overall plan constraint
//     const plan = new Plan();

//     // implicitly put the step on the plan root
//     const step1 = plan.addStep((duration = [0, 1]));
//     plan.addStep((follows = step1), (duration = [5, 10]));

//     // summed durations
//     expect(plan.getDuration()).to.equal([5, 11]);
//   });

//   it("should allow new steps to precede old ones", () => {
//     // no duration given to the plan, so no overall plan constraint
//     const plan = new Plan();

//     // implicitly put the step on the plan root
//     const step1 = plan.addStep((duration = [0, 1]));
//     // insert this step between the root and step 1
//     plan.addStep((precedes = step1), (duration = [5, 10]));

//     // summed durations
//     expect(plan.getDuration()).to.equal([5, 11]);
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

//   it("should compute plan durations with overall constraints", () => {
//     // put a constraint on the root
//     const plan = new Plan((duration = [8, 20]));

//     const step1 = plan.addStep((duration = [0, 1]));
//     plan.addStep((follows = step1), (duration = [5, 10]));
//     plan.addStep((precedes = step1), (duration = [4, 8]));

//     // union summed step duration with the plan's duration
//     expect(plan.getDuration()).to.equal([9, 19]);
//   });

//   describe("Step", () => {
//     it("should register an onChange callback", () => {
//       const plan = new Plan();
//     });
//   });
// });

// describe("STN", () => {
//   it("should create a graph from a set of edges", () => {
//     const stn = new STN();
//     const [numNodes, numEdges] = stn.initialize(example1, {
//       implicit_intervals: false
//     });
//     expect(numNodes).to.equal(4);
//     expect(numEdges).to.equal(12);
//   });
// });
// });
