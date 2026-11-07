import test from "node:test";
import assert from "node:assert/strict";
import {
  TAU, BRANCH_START, BRANCH_END, WAGON_OFFSETS, BRIDGE_HEIGHT,
  getTrackPose, bridgeLift, isOnBranchSection,
  crossesAngle, routeForCar, turnoutsForTrain,
} from "../train3d-track.mjs";

test("the new 3D main line has the original figure-eight layout", () => {
  for (const angle of [0, 0.45, Math.PI / 2, Math.PI, 4.4, TAU - 0.1]) {
    const p = getTrackPose(angle);
    assert.ok(Math.abs(p.x - 18 * Math.sin(angle)) < 1e-9);
    assert.ok(Math.abs(p.z - 28 * 0.58 * Math.sin(angle) * Math.cos(angle)) < 1e-9);
  }
});

test("the crossing has a raised bridge, and the branch stays on the ground", () => {
  assert.equal(bridgeLift(0), BRIDGE_HEIGHT);
  assert.equal(bridgeLift(Math.PI), 0);
  assert.equal(bridgeLift(BRANCH_START), 0);
  assert.ok(getTrackPose(0).y > getTrackPose(Math.PI).y + 3);
});

test("the diverging track joins the main line without a jump or kink", () => {
  for (const angle of [BRANCH_START, BRANCH_END]) {
    const a = getTrackPose(angle, "main");
    const b = getTrackPose(angle, "branch");
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-8);
    assert.ok(Math.abs(a.tx - b.tx) < 1e-8);
    assert.ok(Math.abs(a.tz - b.tz) < 1e-8);
  }
  const middle = getTrackPose((BRANCH_START + BRANCH_END) / 2, "branch");
  assert.ok(middle.x > getTrackPose((BRANCH_START + BRANCH_END) / 2, "main").x + 7);
});

test("route selection works at the points and rear car rejoins", () => {
  const arrived = turnoutsForTrain({branchSelected:true, branchTrip:false}, BRANCH_START - 0.03, BRANCH_START + 0.03);
  assert.equal(arrived.branchTrip, true);
  assert.equal(arrived.entered, true);
  assert.equal(routeForCar(BRANCH_START + 0.03, arrived.branchTrip), "branch");
  assert.equal(routeForCar(BRANCH_START - WAGON_OFFSETS[0], arrived.branchTrip), "main");
  assert.equal(isOnBranchSection(BRANCH_START - 0.01), false);
  const departed = turnoutsForTrain({branchSelected:false, branchTrip:true},
    BRANCH_END + WAGON_OFFSETS.at(-1) - 0.03, BRANCH_END + WAGON_OFFSETS.at(-1) + 0.03);
  assert.equal(departed.branchTrip, false);
  const plain = turnoutsForTrain({branchSelected:false, branchTrip:false}, BRANCH_START - 0.03, BRANCH_START + 0.03);
  assert.equal(plain.branchTrip, false);
});

test("turnout crossing works around the circular lap", () => {
  assert.equal(crossesAngle(TAU - 0.04, 0.04, 0), true);
  assert.equal(crossesAngle(1.0, 1.1, 2.0), false);
  assert.equal(crossesAngle(2.0, 2.1, 2.05), true);
});
