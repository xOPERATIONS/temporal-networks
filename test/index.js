const { expect } = require("chai");
const wasm = require("../pkg");
const { Plan, STN } = wasm;

// taken from MIT 16.412 L02 (see docs/references/)
const example1 = {
  edges: [
    { source: 0, target: 1, interval: [1, 10] },
    { source: 0, target: 2, interval: [0, 9] },
    { source: 1, target: 3, interval: [1, 1] },
    { source: 2, target: 3, interval: [2, 2] }
  ]
};

describe("temporal-networks", () => {
  it("should have importable WASM", () => {
    expect(wasm).to.be.ok;
  });

  describe("Plan", () => {
    it("should have a root", () => {
      const plan = new Plan();

      expect(plan.getRoot()).to.be.a("Step");
    });

    it('should be able to create a step', () => {
      const plan = new Plan();
      const step = plan.createStep(duration=[0, 1]);
      expect(step).to.be.ok;
      expect(step.interval).to.equal([0, 1]);
      expect(step.start).to.equal(0);
    });

    it("should give high level statistics", () => {
      const plan = new Plan();

      expect(plan.getDuration()).to.equal([0, 0]);
    })

    it("should compose steps", () => {
      // no duration given to the plan, so no overall plan constraint
      const plan = new Plan();

      // implicitly put the step on the plan root
      const step1 = plan.createStep(duration=[0, 1]);
      plan.createStep(follows=step1, duration=[5, 10]);

      // summed durations
      expect(plan.getDuration()).to.equal([5, 11]);
    })

    it("should allow new steps to precede old ones", () => {
      // no duration given to the plan, so no overall plan constraint
      const plan = new Plan();

      // implicitly put the step on the plan root
      const step1 = plan.createStep(duration=[0, 1]);
      // insert this step between the root and step 1
      plan.createStep(precedes=step1, duration=[5, 10]);

      // summed durations
      expect(plan.getDuration()).to.equal([5, 11]);
    })

    it("should allow parallel steps", () => {
      const plan = new Plan();

      // two steps in parallel; both start at the plan root
      plan.createStep(follows=plan.getRoot(), duration=[4, 9]);
      plan.createStep(follows=plan.getRoot(), duration=[5, 10]);

      // union the intervals
      expect(plan.getDuration()).to.equal([5, 9]);
    })

    it("should compute plan durations with overall constraints", () => {
      // put a constraint on the root
      const plan = new Plan(duration=[8, 20]);

      const step1 = plan.createStep(duration=[0, 1]);
      plan.createStep(follows=step1, duration=[5, 10]);
      plan.createStep(precedes=step1, duration=[4, 8]);

      // union summed step duration with the plan's duration
      expect(plan.getDuration()).to.equal([9, 19]);
    })

    describe('Step', () => {
      it('should register an onChange callback', () => {
        const plan = new Plan();
      })
    })
  })

  describe("STN", () => {
    it("should create a graph from a set of edges", () => {
      const stn = new STN();
      const [numNodes, numEdges] = stn.initialize(example1, {
        implicit_intervals: false
      });
      expect(numNodes).to.equal(4);
      expect(numEdges).to.equal(12);
    });
  });
});
