const { expect } = require("chai");
const wasm = require("../pkg");
const { install } = wasm;

describe("temporal-networks", () => {
  before(install);

  it("should have importable WASM", () => {
    expect(wasm).to.be.ok;
  });
});
