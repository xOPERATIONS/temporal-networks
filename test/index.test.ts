import { install } from "../tmp/index";

describe("temporal-networks", () => {
  beforeAll(install);

  it("should have importable WASM", () => {
    expect(install).toBeDefined();
  });
});
