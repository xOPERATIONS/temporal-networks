const { expect } = require("chai");
const { install, Mission } = require("../pkg");

describe("Mission high level API", () => {
  before(install);

  it("should create a mission", () => {
    const mission = new Mission();
    expect(mission).to.be.ok;
    expect(mission instanceof Mission).to.be.true;
    bar();
  });

  // it("should have a limiting consumable by default", () => {
  //   const mission = createMission();
  //   const graph = mission.d3Dump();
  //   expect(graph[0].description).to.equal(LIM_CONS);
  // });

  // it("should create actors", () => {
  //   const mission = createMission();
  //   const actor = mission.createActor("EV1");
  // });

  // it("should create steps", () => {
  //   const mission = createMission();
  //   const actor = mission.createActor("EV1");
  //   const step = mission.createStep(actor, "EGRESS/SETUP");
  // });

  // it("should compose steps", () => {
  //   const mission = createMission();
  //   const actor = mission.createActor("EV1");
  //   const step1 = mission.createStep(actor, "EGRESS/SETUP");
  //   const step2 = mission.createStep(actor, "MISSE7");
  //   // add a constraint between the steps
  //   mission.compose([step1, step2]);
  // });

  // it("should append steps", () => {
  //   const mission = createMission();
  //   const actor = mission.createActor("EV1");
  //   const step1 = mission.createStep(actor, "EGRESS/SETUP");
  //   const step2 = mission.createStep(actor, "MISSE7");
  //   // put them at the end of whatever is already there
  //   mission.append([step1, step2]);
  // });

  // it("should create substeps", () => {
  //   const mission = createMission();
  //   const actor = mission.createActor("EV1");
  //   const step1 = mission.createStep(actor, "EGRESS/SETUP");
  //   const substep = mission.createSubstep(step1, "Activate ORU");
  // });

  // it("should put steps by different actors in parallel", () => {
  //   const mission = createMission();
  //   const ev1 = mission.createActor("EV1");
  //   const ev2 = mission.createActor("EV2");

  //   const egress = mission.createSync("EGRESS/SETUP");
  //   createStep(egress, ev1, "DON HELMET");
  //   createStep(egress, ev2, "DON HELMET");
  // });
});
