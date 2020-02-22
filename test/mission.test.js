const { expect } = require("chai");
const { install, createMission, compose, LIM_CONS } = require("../pkg");

describe("EVA high level API", () => {
  before(install);

  it("should create an mission", () => {
    const mission = createMission();
    expect(mission).to.be.ok;
  });

  it("should have a limiting consumable by default", () => {
    const mission = createMission();
    const graph = d3_dump(mission);
    expect(graph[0].description).to.equal(LIM_CONS);
  });

  it("should create actors", () => {
    const mission = createMission();
    const actor = createActor(mission, "EV1");
  });

  it("should create steps", () => {
    const mission = createMission();
    const actor = createActor(mission, "EV1");
    const step = createStep(mission, actor, "EGRESS/SETUP");
  });

  it("should compose steps", () => {
    const mission = createMission();
    const actor = createActor(mission, "EV1");
    const step1 = createStep(mission, actor, "EGRESS/SETUP");
    const step2 = createStep(mission, actor, "MISSE7");
    // add a constraint between the steps
    compose(mission, [step1, step2]);
  });

  it("should append steps", () => {
    const mission = createMission();
    const actor = createActor(mission, "EV1");
    const step1 = createStep(mission, actor, "EGRESS/SETUP");
    const step2 = createStep(mission, actor, "MISSE7");
    // put them at the end of whatever is already there
    append(mission, [step1, step2]);
  });

  it("should create substeps", () => {
    const mission = createMission();
    const actor = createActor(mission, "EV1");
    const step1 = createStep(mission, actor, "EGRESS/SETUP");
    const substep = createSubstep(mission, step1, "Activate ORU");
  });
});
