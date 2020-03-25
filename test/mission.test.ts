import { install, Schedule } from "../tmp";
import { appendTask, createMission, syncPoints, Step } from '../lib/mission';

describe("Mission high level API", () => {
  beforeAll(install);

  it("should create a mission", () => {
    const schedule = new Schedule();
    const mission = createMission(schedule);
    expect(mission).toBeDefined();
    expect(mission instanceof Step).toBeTruthy();
  });

  describe("Mission", () => {
    it("should create a step with an actor", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const actor1 = "EV1";
      const duration1 = [10, 20];
      const description1 = "A1";

      const step1 = mission.createStep(description1, duration1, actor1);

      expect(step1).toBeDefined();
      expect(step1.actor).toEqual(actor1);
    });

    it("should create a step without an actor", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const duration1 = [10, 20];
      const description1 = "A1";

      const step1 = mission.createStep(description1, duration1);

      expect(step1).toBeDefined();
      expect(step1.actor).toEqual("");
    });
  });

  describe("Step", () => {
    it("should report a planned duration", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const actor1 = "EV1";
      const duration1 = [10, 20];
      const description1 = "A1";

      const step1 = mission.createStep(description1, duration1, actor1);

      expect(step1.plannedDuration()).toEqual(duration1);
    });

    it("should report a description", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const actor1 = "EV1";
      const duration1 = [10, 20];
      const description1 = "A1";

      const step1 = mission.createStep(description1, duration1, actor1);

      expect(step1.description).toEqual(description1);
    });

    it("should create a substep", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const actor1 = "EV1";
      const step = mission.createStep("parent", [10, 20], actor1);

      const substep = step.createStep("child", [0, 5], actor1);
      expect(substep._parent).toEqual(step);
    });

    it("should throw if the substeps must take longer than the step", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const actor1 = "EV1";

      const parentDuration = [1, 2];
      const childDuration = [3, 4];
      const step = mission.createStep("parent", parentDuration, actor1);
      step.createStep("child", childDuration, actor1);

      expect(() => mission.construct()).toThrow();
    });

    it("should allow substeps that might exceed the max", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const actor1 = "EV1";

      const parentDuration = [4, 8];
      const childDuration = [3, 9];
      const step = mission.createStep("parent", parentDuration, actor1);
      const substep = step.createStep("child", childDuration, actor1);

      // with the slack time built into substeps, 3 is still is a valid duration
      // the substep still can't exceed the parent
      expect(substep.plannedDuration()).toEqual([3, 8]);
    });

    it("should let you know of potential problems", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const actor1 = "EV1";

      const parentDuration = [4, 8];
      const childDuration = [3, 9];
      const step = mission.createStep("parent", parentDuration, actor1);
      step.createStep("child", childDuration, actor1);

      const { warnings } = mission.validate();

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("maximum duration");
    });

    it("should be able to move a substep to a different actor", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const ev1 = "EV1";
      const ev2 = "EV2";

      const step = mission.createStep("EGRESS", [0, 45], ev1);
      mission.changeActor(step, ev2);

      expect(step.actor).toEqual(ev2);
    });

    it("should provide a 0-indexed execution window with one activity", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);

      // as defined when a mission is created
      expect(mission.plannedStartWindow()).toEqual([0, 0]);

      const ev1 = "EV1";
      const step1 = mission.createStep("EGRESS", [1, 3], ev1);

      // step1 should start immediately
      expect(step1.plannedStartWindow()).toEqual([0, 0]);
    });

    it("should provide 0-indexed execution windows", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const ev1 = "EV1";

      const step1 = mission.createStep("EGRESS", [1, 3], ev1);
      const step2 = mission.createStep("TRAVERSE", [5, 7], ev1);

      expect(step1.plannedStartWindow()).toEqual([0, 0]);
      expect(step2.plannedStartWindow()).toEqual([1, 3]);
    });

    it("should provide reasonable execution windows for steps in series", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const ev1 = "EV1";

      const step1 = mission.createStep("EGRESS", [1, 3], ev1);
      const step2 = mission.createStep("TRAVERSE", [5, 7], ev1);
      const step3 = mission.createStep("STATION", [5, 7], ev1);

      step1.completedAt(2);
      expect(step2.plannedStartWindow()).toEqual([2, 2]);
      expect(step3.plannedStartWindow()).toEqual([7, 9]);

      step2.completedAt(8.);
      expect(step3.plannedStartWindow()).toEqual([8, 8]);
    });

    it("should provide 0-indexed execution windows for steps in parallel", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const ev1 = "EV1";
      const ev2 = "EV2";

      const step1 = mission.createStep("EGRESS", [1, 3], ev1);
      const step2 = mission.createStep("EGRESS", [5, 7], ev2);

      expect(step1.plannedStartWindow()).toEqual([0, 0]);
      expect(step2.plannedStartWindow()).toEqual([0, 0]);
    });

    it("should provide execution windows for a bunch of steps in parallel", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const ev1 = "EV1";
      const ev2 = "EV2";

      const step1 = mission.createStep("EGRESS", [0, 2], ev1);
      const step2 = mission.createStep("EGRESS", [1, 3], ev2);
      const step3 = mission.createStep("TRAVERSE", [4, 6], ev1);
      const step4 = mission.createStep("TRAVERSE", [5, 7], ev2);
      const step5 = mission.createStep("STATION", [8, 10], ev1);
      const step6 = mission.createStep("STATION", [9, 11], ev2);

      expect(step1.plannedStartWindow()).toEqual([0, 0]);
      expect(step2.plannedStartWindow()).toEqual([0, 0]);
      expect(step3.plannedStartWindow()).toEqual([0, 2]);
      expect(step4.plannedStartWindow()).toEqual([1, 3]);
      expect(step5.plannedStartWindow()).toEqual([4, 8]);
      expect(step6.plannedStartWindow()).toEqual([6, 10]);
    });

    it("should provide execution windows for nested substeps", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const ev1 = "EV1";

      const egress = mission.createStep("EGRESS", [15, 20], ev1);
      const uia = egress.createStep("work UIA", [4, 6], ev1);
      const turnKnob = uia.createStep("turn knob", [1, 3], ev1);
      const pressButton = uia.createStep("press button", [3, 3], ev1);
      const depress = egress.createStep("start depress", [11, 14], ev1);

      expect(egress.plannedStartWindow()).toEqual([0, 0]);
      expect(uia.plannedStartWindow()).toEqual([0, 0]);
      expect(turnKnob.plannedStartWindow()).toEqual([0, 0]);
      expect(pressButton.plannedStartWindow()).toEqual([1, 3]);
      expect(depress.plannedStartWindow()).toEqual([4, 6]);
    });

    it.skip("should append substeps to the new actor when changing actors", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const ev1 = "EV1";
      const ev2 = "EV2";

      const step1 = mission.createStep("EGRESS", [1, 3], ev1);
      const step2 = mission.createStep("TRAVERSE", [5, 7], ev2);
      expect(step1.plannedStartWindow()).toEqual([0, 0]);

      mission.changeActor(step1, ev2);

      // step2 should start immediately, while step1 will start after step2 has finished
      expect(step2.plannedStartWindow()).toEqual([0, 0]);
      expect(step1.plannedStartWindow()).toEqual([1, 3]);
    });

    it.skip("should reorder steps with the same actor", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const ev1 = "EV1";

      // create 5 substeps under the mission
      for (let i = 0; i++; i <= 5) {
        mission.createStep(`substep-${i}`, [1, 1], ev1);
      }

      // this substep should be last
      const substepToMove = mission.createStep("mover", [1, 1], ev1);
      expect(substepToMove.plannedStartWindow()).toEqual([5, 5]);

      // move the substep
      mission.reorderStep(mission, substepToMove, 3);

      // use the planned start time to see if it moved
      expect(substepToMove.plannedStartWindow()).toEqual([3, 3]);
    });
  });

  describe("#appendTask", () => {
    it("should create 2 sync points one actor two tasks", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const ev1 = "EV1";

      appendTask(mission, ev1, "EGRESS", [0, 10]);
      appendTask(mission, ev1, "TRAVERSE", [0, 10]);

      expect(syncPoints(mission)).toHaveLength(2);
    });

    it("should create 1 sync point for two actors 1 task each", () => {
      const schedule = new Schedule();
      const mission = createMission(schedule);
      const ev1 = "EV1";
      const ev2 = "EV2";

      appendTask(mission, ev1, "EGRESS", [0, 10]);
      appendTask(mission, ev2, "EGRESS", [0, 10]);

      expect(syncPoints(mission)).toHaveLength(1);
    });
  })

  // it("should create 1 step for EV1 and 2 steps (nested) for EV2", () => {
  // const schedule = new Schedule();
  // const mission = createMission(schedule);
  //   const actor1 = "EV1";
  //   const actor2 = "EV2";

  //   const duration1 = [10, 20];
  //   const description1 = "A1";
  //   const step1 = mission.createStep(description1, duration1, actor1);

  //   expect(step1).toBeDefined();
  //   expect(step1.description).toEqual(description1);
  //   expect(step1.duration()).toEqual(duration1);

  //   const duration2 = [10, 20];
  //   const description2 = "A2";
  //   const step2 = mission.createStep(description2, duration2, actor2);

  //   expect(step2).toBeDefined();
  //   expect(step2.description).toEqual(description2);
  //   expect(step2.duration()).toEqual(duration2);

  //   const duration3 = [10, 20];
  //   const description3 = "A3";
  //   const step3 = mission.createStep(description3, duration3, actor2);

  //   //I expect that since the actors are the same
  //   expect(step3).toBeDefined();
  //   expect(step3.description).toEqual(description3);
  //   expect(step3.duration()).toEqual(duration3);

  //   //makeSubStep(parent, child)
  //   //here we could set step3 to be the substep of step2. Step 3 is still a step, just placing it as a child of step2. Thus implying it would be (A2s -> (A3s -> A3e) -> A2e)
  //   mission.makeSubStep(step2, step3); //not sure if you'd need a return type

  //   // or
  //   step2.addSubstep(step3);

  //   // or create and add constraints
  //   step2.createSubstep(description3, duration3, actor2);
  // });

  // it("should create 3 steps for EV 2 (with 2 nested)", () => {
  // const schedule = new Schedule();
  // const mission = createMission(schedule);
  //   const actor2 = "EV2";

  //   const duration1 = [10, 20];
  //   const description1 = "A1";
  //   const step1 = mission.createStep(description1, duration1, actor2);

  //   expect(step1).toBeDefined();
  //   expect(step1.description).toEqual(description1);
  //   expect(step1.duration()).toEqual(duration1);

  //   const duration2 = [10, 20];
  //   const description2 = "A2";
  //   const step2 = mission.createStep(description2, duration2, actor2);

  //   expect(step2).toBeDefined();
  //   expect(step2.description).toEqual(description2);
  //   expect(step2.duration()).toEqual(duration2);

  //   // slide 16, linking A1 - A2 as a 'sync'. This should be implied by the fact they are different steps. Any step to step should imply a sync point.
  //   mission.linkSteps(step1, step2);

  //   // or
  //   step1.link(step2);
  //   step2.link(step1);

  //   const duration3 = [10, 20];
  //   const description3 = "A3";
  //   const step3 = mission.createStep(description3, duration3, actor2);

  //   //I expect that since the actors are the same
  //   expect(step3).toBeDefined();
  //   expect(step3.description).toEqual(description3);
  //   expect(step3.duration()).toEqual(duration3);

  //   //makeSubStep(parent, child)
  //   //here we could set step3 to be the substep of step2. Step 3 is still a step, just placing it as a child of step2. Thus implying it would be (A2s -> (A3s -> A3e) -> A2e)
  //   mission.makeSubStep(step2, step3); //not sure if you'd need a return type
  // });

  // it("should create 3 nested steps for EV 2", () => {
  // const schedule = new Schedule();
  // const mission = createMission(schedule);
  //   const actor2 = "EV2";

  //   const duration1 = [10, 20];
  //   const description1 = "A1";
  //   const step1 = mission.createStep(description1, duration1, actor2);

  //   expect(step1).toBeDefined();
  //   expect(step1.description).toEqual(description1);
  //   expect(step1.duration()).toEqual(duration1);

  //   const duration2 = [10, 20];
  //   const description2 = "A2";
  //   const step2 = mission.createStep(description2, duration2, actor2);

  //   expect(step2).toBeDefined();
  //   expect(step2.description).toEqual(description2);
  //   expect(step2.duration()).toEqual(duration2);

  //   mission.makeSubStep(step1, step2); //makeSubStep(parent, child)

  //   const duration3 = [10, 20];
  //   const description3 = "A3";
  //   const step3 = mission.createStep(description3, duration3, actor2);

  //   //I expect that since the actors are the same
  //   expect(step3).toBeDefined();
  //   expect(step3.description).toEqual(description3);
  //   expect(step3.duration()).toEqual(duration3);

  //   //makeSubStep(parent, child)
  //   //here we could set step3 to be the substep of step2. Step 3 is still a step, just placing it as a child of step2. Thus implying it would be (A2s -> (A3s -> A3e) -> A2e)
  //   mission.makeSubStep(step2, step3); //not sure if you'd need a return type
  // });

  // it("should create steps", () => {
  // const schedule = new Schedule();//
  // const mission = createMission(schedule);
  //   const actor = "EV1";
  //   const duration = [10, 20];
  //   const step = mission.createStep(actor, "EGRESS/SETUP", duration);
  //   expect(mission.timing(step).duration).toEqual(duration);
  //   expect(mission.timing(step).execution_window).toEqual(duration);
  // });

  // it("should have a limiting consumable by default", () => {
  // const schedule = new Schedule();//
  // const mission = createMission(schedule);
  //   const graph = mission.d3Dump();
  //   expect(graph[0].description).toEqual(LIM_CONS);
  // });

  // it("should compose steps", () => {
  // const schedule = new Schedule();//
  // const mission = createMission(schedule);
  //   const actor = "EV1";
  //   const step1 = mission.createStep(actor, "EGRESS/SETUP");
  //   const step2 = mission.createStep(actor, "MISSE7");
  //   // add a constraint between the steps
  //   mission.compose([step1, step2]);
  // });

  // it("should append steps", () => {
  // const schedule = new Schedule();//
  // const mission = createMission(schedule);
  //   const actor = "EV1";
  //   const step1 = mission.createStep(actor, "EGRESS/SETUP");
  //   const step2 = mission.createStep(actor, "MISSE7");
  //   // put them at the end of whatever is already there
  //   mission.append([step1, step2]);
  // });

  // it("should create substeps", () => {
  // const schedule = new Schedule();//
  // const mission = createMission(schedule);
  //   const actor = "EV1";
  //   const step1 = mission.createStep(actor, "EGRESS/SETUP");
  //   const substep = mission.createSubstep(step1, "Activate ORU");
  // });

  // it("should put steps by different actors in parallel", () => {
  // const schedule = new Schedule();//
  // const mission = createMission(schedule);
  //   const ev1 = "EV1";
  //   const ev2 = "EV2";

  //   const egress = mission.createSync("EGRESS/SETUP");
  //   createStep(egress, ev1, "DON HELMET");
  //   createStep(egress, ev2, "DON HELMET");
  // });
});
