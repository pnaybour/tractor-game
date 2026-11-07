import test from "node:test";
import assert from "node:assert/strict";
import {
  TAU, BRANCH_START, BRANCH_END, BRANCH_STATION_ANGLE, BRANCH_STRAIGHTS,
  BRANCH_LENGTH, MAIN_SECTION_LENGTH, BRANCH_SPEED_FACTOR,
  WAGON_OFFSETS, BRIDGE_HEIGHT,
  getTrackPose, getWagonAngle, bridgeLift, isOnBranchSection,
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


test("the longer branch contains three genuinely straight sections", () => {
  assert.equal(BRANCH_STRAIGHTS.length, 3);
  assert.ok(BRANCH_LENGTH > MAIN_SECTION_LENGTH * 2.2,
    "the new branch should be substantially longer than the direct loop");
  assert.ok(BRANCH_SPEED_FACTOR < 0.5 && BRANCH_SPEED_FACTOR > 0.25,
    "the train should take correspondingly longer to travel the branch");
  for (const { start, end, length } of BRANCH_STRAIGHTS) {
    assert.ok(length >= 7.99, "each straight should be at least eight world units long");
    const first = getTrackPose(start + (end - start) * 0.15, "branch");
    const centre = getTrackPose(start + (end - start) * 0.50, "branch");
    const last = getTrackPose(start + (end - start) * 0.85, "branch");
    const crossProduct = (centre.x - first.x) * (last.z - first.z) -
      (centre.z - first.z) * (last.x - first.x);
    assert.ok(Math.abs(crossProduct) < 1e-7, "straight points must be collinear");
    assert.ok(Math.abs(first.tx - last.tx) < 1e-9);
    assert.ok(Math.abs(first.tz - last.tz) < 1e-9);
  }
});

test("the Bluebell Halt station is centred on the long straight beside the rails", () => {
  const [departure, middle, arrival] = BRANCH_STRAIGHTS;
  assert.ok(BRANCH_STATION_ANGLE > middle.start);
  assert.ok(BRANCH_STATION_ANGLE < middle.end);
  const pose = getTrackPose(BRANCH_STATION_ANGLE, "branch");
  assert.ok(Math.abs(pose.x - 32) < 1e-7);
  assert.ok(Math.abs(pose.z) < 1e-7);
  assert.equal(pose.route, "branch");
  assert.ok(Math.abs(pose.tx) < 1e-9, "station track heads north/south");
  assert.ok(Math.abs(pose.tz + 1) < 1e-9);
  assert.ok(middle.length >= 19.99);
  assert.ok(arrival.start > middle.end);
  assert.ok(departure.end < middle.start);
});

test("the longer branch has a smooth heading and near-uniform travel steps", () => {
  const points = [];
  for (let i = 0; i <= 150; i++) {
    const angle = BRANCH_START + (BRANCH_END - BRANCH_START) * i / 150;
    const pose = getTrackPose(angle, "branch");
    points.push(pose);
    assert.ok(pose.x <= 34 && pose.x >= 9,
      "the branch remains inside the railway board");
    assert.ok(Math.abs(pose.z) <= 18);
  }
  const steps = points.slice(1).map((p, i) => {
    const last = points[i];
    const forward = p.tx * last.tx + p.tz * last.tz;
    assert.ok(forward > 0.97, "track should not contain sudden sharp turns");
    return Math.hypot(p.x - last.x, p.z - last.z);
  });
  const average = steps.reduce((a, b) => a + b, 0) / steps.length;
  for (const step of steps) {
    assert.ok(Math.abs(step - average) / average < 0.08,
      "distance-based parameterisation should keep speed roughly constant");
  }
});


test("both carriages retain their main-line spacing through the long diversion", () => {
  for (const offset of WAGON_OFFSETS) {
    // At the entry turnout and again at the exit, there must be no jump.
    assert.ok(Math.abs(getWagonAngle(BRANCH_START, offset, true) -
      (BRANCH_START - offset)) < 1e-3);
    assert.ok(Math.abs(getWagonAngle(BRANCH_END + offset, offset, true) -
      BRANCH_END) < 2e-3);

    // On the station straight the carriages remain a sensible distance back.
    const following = getWagonAngle(BRANCH_STATION_ANGLE, offset, true);
    assert.ok(following > BRANCH_START && following < BRANCH_STATION_ANGLE);
    const gap = (BRANCH_STATION_ANGLE - following) *
      (BRANCH_LENGTH / (BRANCH_END - BRANCH_START));
    assert.ok(gap >= 6 && gap < 16,
      "carriages must not separate by the old oversized angular gap");
    assert.ok(getTrackPose(following, "branch").x > 20,
      "both coaches follow the new branch instead of the main loop");
  }
});
