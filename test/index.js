const { expect } = require("chai");
const wasm = require("../pkg");
const { STN } = wasm;

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
  it("should be importable", () => {
    expect(wasm).to.be.ok;
  });

  describe("#initialize", () => {
    it("should create a graph from a set of edges", () => {
      const stn = new STN();
      const res = stn.initialize(example1, {
        implicit_intervals: false
      });
      const [numNodes, numEdges] = res;
      expect(numNodes).to.equal(4);
      expect(numEdges).to.equal(8);
    });

    it("should have the correct implicit intervals", () => {
      const stn = new STN();
      stn.initialize(example1, {
        implicit_intervals: false
      });
      console.log(stn.dumpConstraintTable());
      expect(true).to.be.false;
    });
  });
});
