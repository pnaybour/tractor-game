// Shared deterministic track geometry for browser rendering and Node tests.
// The original toy train's main route is x=sin(t), y=0.58*sin(t)*cos(t).
// World coordinates are X/Z; the wooden bridge is elevated over the crossing.
export const TAU = Math.PI * 2;
export const BRANCH_START = 0.55;
export const BRANCH_END = 2.59;
export const BRANCH_OUTWARD = 7.5;
export const WAGON_OFFSETS = [0.33, 0.66];
export const BRIDGE_SPAN = 0.47;
export const BRIDGE_HEIGHT = 3.8;

export function normaliseAngle(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

export function circularDistance(a, b) {
  const distance = Math.abs(normaliseAngle(a - b));
  return Math.min(distance, TAU - distance);
}

export function isOnBranchSection(angle) {
  const t = normaliseAngle(angle);
  return t >= BRANCH_START && t <= BRANCH_END;
}

export function bridgeLift(angle) {
  const distance = circularDistance(angle, 0);
  return distance < BRIDGE_SPAN
    ? BRIDGE_HEIGHT * (1 + Math.cos(Math.PI * distance / BRIDGE_SPAN)) / 2
    : 0;
}

export function getTrackPose(angle, route = "main") {
  const t = normaliseAngle(angle);
  const onBranch = route === "branch" && isOnBranchSection(t);
  const progress = onBranch ? (t - BRANCH_START) / (BRANCH_END - BRANCH_START) : 0;
  const phase = Math.PI * progress;
  // sin^2 gives zero offset and zero first derivative at both junctions.
  const outward = onBranch ? BRANCH_OUTWARD * Math.sin(phase) ** 2 : 0;
  const outwardDerivative = onBranch
    ? BRANCH_OUTWARD * Math.PI * Math.sin(2 * phase) / (BRANCH_END - BRANCH_START)
    : 0;
  const dx = 18 * Math.cos(t) + outwardDerivative;
  const dz = 28 * 0.58 * Math.cos(2 * t);
  const tangentLength = Math.hypot(dx, dz);
  return {
    x: 18 * Math.sin(t) + outward,
    y: 0.22 + bridgeLift(t),
    z: 28 * 0.58 * Math.sin(t) * Math.cos(t),
    heading: Math.atan2(dx, dz), // train model is built facing +Z
    tx: dx / tangentLength,
    tz: dz / tangentLength,
    angle: t,
    route: onBranch ? "branch" : "main",
  };
}

export function crossesAngle(from, to, target) {
  const distanceTravelled = normaliseAngle(to - from);
  const distanceToTarget = normaliseAngle(target - from);
  return distanceTravelled > 0 && distanceToTarget > 0 &&
    distanceToTarget <= distanceTravelled;
}

export function routeForCar(angle, branchTrip) {
  return branchTrip && isOnBranchSection(angle) ? "branch" : "main";
}

export function turnoutsForTrain(state, previousAngle, currentAngle) {
  // Called once per movement step. Switching points while travelling along
  // the branch applies to the next entry and cannot teleport the train.
  let active = state.branchTrip;
  let entered = false;
  if (crossesAngle(previousAngle, currentAngle, BRANCH_START)) {
    active = state.branchSelected;
    entered = active;
  }
  if (active && crossesAngle(previousAngle, currentAngle, BRANCH_END + WAGON_OFFSETS.at(-1))) {
    active = false; // rear wagon has rejoined the main route
  }
  return { branchTrip: active, entered };
}
