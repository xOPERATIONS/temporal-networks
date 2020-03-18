const { expect } = require("chai");
const { install, Actor, Mission, Step } = require("../pkg");

describe("Mission high level API", () => {
  before(install);

  it("should create a mission", () => {
    const mission = new Mission();
    expect(mission).to.be.ok;
    expect(mission instanceof Step).to.be.true;
  });

  it("should create actors", () => {
    const mission = new Mission();
    const actor = mission.createActor("EV1");

    expect(actor).to.be.ok;
    expect(actor instanceof Actor).to.be.true;
    expect(actor.name).to.equal("EV1");
  });

  describe("Mission", () => {
    it("should create a step with an actor", () => {
      const mission = new Mission();
      const actor1 = mission.createActor("EV1");
      const duration1 = [10, 20];
      const description1 = "A1";

      const step1 = mission.createStep(description1, duration1, actor1);

      expect(step1).to.be.ok;
      expect(step1.actor).to.equal(actor1);
    });

    it("should create a step without an actor", () => {
      const mission = new Mission();
      const duration1 = [10, 20];
      const description1 = "A1";

      const step1 = mission.createStep(description1, duration1);

      expect(step1).to.be.ok;
      expect(step1.actor.name).to.be.empty;
    });
  });

  describe("Step", () => {
    it("should report a planned duration", () => {
      const mission = new Mission();
      const actor1 = mission.createActor("EV1");
      const duration1 = [10, 20];
      const description1 = "A1";

      const step1 = mission.createStep(description1, duration1, actor1);

      expect(step1.plannedDuration()).to.deep.equal(duration1);
    });

    it("should report a description", () => {
      const mission = new Mission();
      const actor1 = mission.createActor("EV1");
      const duration1 = [10, 20];
      const description1 = "A1";

      const step1 = mission.createStep(description1, duration1, actor1);

      expect(step1.description).to.equal(description1);
    });

    it("should create a substep", () => {
      const mission = new Mission();
      const actor1 = mission.createActor("EV1");
      const step = mission.createStep("parent", [10, 20], actor1);

      const substep = step.createStep("child", [0, 5], actor1);
      expect(substep._parent).to.equal(step);
    });

    it("should throw if the substeps must take longer than the step", () => {
      const mission = new Mission();
      const actor1 = mission.createActor("EV1");

      const parentDuration = [1, 2];
      const childDuration = [3, 4];
      const step = mission.createStep("parent", parentDuration, actor1);
      step.createStep("child", childDuration, actor1);

      expect(() => mission.construct()).to.throw();
    });

    it("should allow substeps that might exceed the max", () => {
      const mission = new Mission();
      const actor1 = mission.createActor("EV1");

      const parentDuration = [4, 8];
      const childDuration = [3, 9];
      const step = mission.createStep("parent", parentDuration, actor1);
      const substep = step.createStep("child", childDuration, actor1);

      // with the slack time built into substeps, 3 is still is a valid duration
      // the child's max exceeds the parent, but that's not necessarily a problem
      expect(substep.plannedDuration()).to.deep.equal([3, 9]);
    });

    it("should let you know of potential problems", () => {
      const mission = new Mission();
      const actor1 = mission.createActor("EV1");

      const parentDuration = [4, 8];
      const childDuration = [3, 9];
      const step = mission.createStep("parent", parentDuration, actor1);
      step.createStep("child", childDuration, actor1);

      const { warnings } = mission.validate();

      expect(warnings).to.have.lengthOf(1);
      expect(warnings[0]).to.include("maximum duration");
    });

    it("should be able to move a substep to a different actor", () => {
      const mission = new Mission();
      const ev1 = mission.createActor("EV1");
      const ev2 = mission.createActor("EV2");

      const step = mission.createStep("EGRESS", [0, 45], ev1);
      mission.changeActor(step, ev2);

      expect(step.actor).to.equal(ev2);
    });

    it.skip("should provide a 0-indexed execution window with one activity", () => {
      const mission = new Mission();

      // as defined when a mission is created
      expect(mission.plannedStartWindow()).to.deep.equal([0, 0]);

      const ev1 = mission.createActor("EV1");
      const step1 = mission.createStep("EGRESS", [1, 3], ev1);

      mission.debug();

      // step1 should start immediately
      expect(step1.plannedStartWindow()).to.deep.equal([0, 0]);
    });

    it.skip("should provide 0-indexed execution windows", () => {
      const mission = new Mission();
      const ev1 = mission.createActor("EV1");

      const step1 = mission.createStep("EGRESS", [1, 3], ev1);
      const step2 = mission.createStep("TRAVERSE", [5, 7], ev1);
      expect(step1.plannedStartWindow()).to.deep.equal([0, 0]);
      expect(step2.plannedStartWindow()).to.deep.equal([1, 3]);
    });

    it.skip("should append substeps to the new actor when changing actors", () => {
      const mission = new Mission();
      const ev1 = mission.createActor("EV1");
      const ev2 = mission.createActor("EV2");

      const step1 = mission.createStep("EGRESS", [1, 3], ev1);
      const step2 = mission.createStep("EGRESS", [5, 7], ev2);
      expect(step1.plannedStartWindow()).to.deep.equal([0, 0]);

      mission.changeActor(step1, ev2);

      // step2 should start immediately, while step1 will start after step2 has finished
      expect(step2.plannedStartWindow()).to.deep.equal([0, 0]);
      expect(step1.plannedStartWindow()).to.deep.equal([1, 3]);
    });

    it.skip("should reorder steps with the same actor", () => {
      const mission = new Mission();
      const ev1 = mission.createActor("EV1");

      // create 5 substeps under the mission
      for (let i = 0; i++; i <= 5) {
        mission.createStep(`substep-${i}`, [1, 1], ev1);
      }

      // this substep should be last
      const substepToMove = mission.createStep("mover", [1, 1], ev1);
      expect(substepToMove.plannedStartWindow()).to.deep.equal([5, 5]);

      // move the substep
      mission.reorderStep(mission, substepToMove, 3);

      // use the planned start time to see if it moved
      expect(substepToMove.plannedStartWindow()).to.deep.equal([3, 3]);
    });
  });

  // it("should create 1 step for EV1 and 2 steps (nested) for EV2", () => {
  //   const mission = new Mission();
  //   const actor1 = mission.createActor("EV1");
  //   const actor2 = mission.createActor("EV2");

  //   const duration1 = [10, 20];
  //   const description1 = "A1";
  //   const step1 = mission.createStep(description1, duration1, actor1);

  //   expect(step1).to.be.ok;
  //   expect(step1.description).to.equal(description1);
  //   expect(step1.duration()).to.deep.equal(duration1);

  //   const duration2 = [10, 20];
  //   const description2 = "A2";
  //   const step2 = mission.createStep(description2, duration2, actor2);

  //   expect(step2).to.be.ok;
  //   expect(step2.description).to.equal(description2);
  //   expect(step2.duration()).to.deep.equal(duration2);

  //   const duration3 = [10, 20];
  //   const description3 = "A3";
  //   const step3 = mission.createStep(description3, duration3, actor2);

  //   //I expect that since the actors are the same
  //   expect(step3).to.be.ok;
  //   expect(step3.description).to.equal(description3);
  //   expect(step3.duration()).to.deep.equal(duration3);

  //   //makeSubStep(parent, child)
  //   //here we could set step3 to be the substep of step2. Step 3 is still a step, just placing it as a child of step2. Thus implying it would be (A2s -> (A3s -> A3e) -> A2e)
  //   mission.makeSubStep(step2, step3); //not sure if you'd need a return type

  //   // or
  //   step2.addSubstep(step3);

  //   // or create and add constraints
  //   step2.createSubstep(description3, duration3, actor2);
  // });

  // it("should create 3 steps for EV 2 (with 2 nested)", () => {
  //   const mission = new Mission();
  //   const actor2 = mission.createActor("EV2");

  //   const duration1 = [10, 20];
  //   const description1 = "A1";
  //   const step1 = mission.createStep(description1, duration1, actor2);

  //   expect(step1).to.be.ok;
  //   expect(step1.description).to.equal(description1);
  //   expect(step1.duration()).to.deep.equal(duration1);

  //   const duration2 = [10, 20];
  //   const description2 = "A2";
  //   const step2 = mission.createStep(description2, duration2, actor2);

  //   expect(step2).to.be.ok;
  //   expect(step2.description).to.equal(description2);
  //   expect(step2.duration()).to.deep.equal(duration2);

  //   // slide 16, linking A1 - A2 as a 'sync'. This should be implied by the fact they are different steps. Any step to step should imply a sync point.
  //   mission.linkSteps(step1, step2);

  //   // or
  //   step1.link(step2);
  //   step2.link(step1);

  //   const duration3 = [10, 20];
  //   const description3 = "A3";
  //   const step3 = mission.createStep(description3, duration3, actor2);

  //   //I expect that since the actors are the same
  //   expect(step3).to.be.ok;
  //   expect(step3.description).to.equal(description3);
  //   expect(step3.duration()).to.deep.equal(duration3);

  //   //makeSubStep(parent, child)
  //   //here we could set step3 to be the substep of step2. Step 3 is still a step, just placing it as a child of step2. Thus implying it would be (A2s -> (A3s -> A3e) -> A2e)
  //   mission.makeSubStep(step2, step3); //not sure if you'd need a return type
  // });

  // it("should create 3 nested steps for EV 2", () => {
  //   const mission = new Mission();
  //   const actor2 = mission.createActor("EV2");

  //   const duration1 = [10, 20];
  //   const description1 = "A1";
  //   const step1 = mission.createStep(description1, duration1, actor2);

  //   expect(step1).to.be.ok;
  //   expect(step1.description).to.equal(description1);
  //   expect(step1.duration()).to.deep.equal(duration1);

  //   const duration2 = [10, 20];
  //   const description2 = "A2";
  //   const step2 = mission.createStep(description2, duration2, actor2);

  //   expect(step2).to.be.ok;
  //   expect(step2.description).to.equal(description2);
  //   expect(step2.duration()).to.deep.equal(duration2);

  //   mission.makeSubStep(step1, step2); //makeSubStep(parent, child)

  //   const duration3 = [10, 20];
  //   const description3 = "A3";
  //   const step3 = mission.createStep(description3, duration3, actor2);

  //   //I expect that since the actors are the same
  //   expect(step3).to.be.ok;
  //   expect(step3.description).to.equal(description3);
  //   expect(step3.duration()).to.deep.equal(duration3);

  //   //makeSubStep(parent, child)
  //   //here we could set step3 to be the substep of step2. Step 3 is still a step, just placing it as a child of step2. Thus implying it would be (A2s -> (A3s -> A3e) -> A2e)
  //   mission.makeSubStep(step2, step3); //not sure if you'd need a return type
  // });

  // it("should create steps", () => {
  //   const mission = new Mission();
  //   const actor = mission.createActor("EV1");
  //   const duration = [10, 20];
  //   const step = mission.createStep(actor, "EGRESS/SETUP", duration);
  //   expect(mission.timing(step).duration).to.deep.equal(duration);
  //   expect(mission.timing(step).execution_window).to.deep.equal(duration);
  // });

  // it("should have a limiting consumable by default", () => {
  //   const mission = new Mission();
  //   const graph = mission.d3Dump();
  //   expect(graph[0].description).to.equal(LIM_CONS);
  // });

  // it("should compose steps", () => {
  //   const mission = new Mission();
  //   const actor = mission.createActor("EV1");
  //   const step1 = mission.createStep(actor, "EGRESS/SETUP");
  //   const step2 = mission.createStep(actor, "MISSE7");
  //   // add a constraint between the steps
  //   mission.compose([step1, step2]);
  // });

  // it("should append steps", () => {
  //   const mission = new Mission();
  //   const actor = mission.createActor("EV1");
  //   const step1 = mission.createStep(actor, "EGRESS/SETUP");
  //   const step2 = mission.createStep(actor, "MISSE7");
  //   // put them at the end of whatever is already there
  //   mission.append([step1, step2]);
  // });

  // it("should create substeps", () => {
  //   const mission = new Mission();
  //   const actor = mission.createActor("EV1");
  //   const step1 = mission.createStep(actor, "EGRESS/SETUP");
  //   const substep = mission.createSubstep(step1, "Activate ORU");
  // });

  // it("should put steps by different actors in parallel", () => {
  //   const mission = new Mission();
  //   const ev1 = mission.createActor("EV1");
  //   const ev2 = mission.createActor("EV2");

  //   const egress = mission.createSync("EGRESS/SETUP");
  //   createStep(egress, ev1, "DON HELMET");
  //   createStep(egress, ev2, "DON HELMET");
  // });
});
