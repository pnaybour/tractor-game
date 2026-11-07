// Shared railway geometry. The original figure-eight remains unchanged.
// The extended branch follows a tangent straight, an easing curve, a long
// straight through Bluebell Halt, a return curve and a final tangent straight.
// Its distance-based parameterisation keeps the motion smooth at the points.
export const TAU = Math.PI * 2;
export const BRANCH_START = 0.55;
export const BRANCH_END = 2.59;
export const BRANCH_OUTWARD = 32; // X coordinate of the long outer straight
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

function mainPose(angle) {
  const t = normaliseAngle(angle);
  const dx = 18 * Math.cos(t);
  const dz = 28 * 0.58 * Math.cos(2 * t);
  const length = Math.hypot(dx, dz);
  return {
    x: 18 * Math.sin(t),
    y: 0.22 + bridgeLift(t),
    z: 28 * 0.58 * Math.sin(t) * Math.cos(t),
    heading: Math.atan2(dx, dz), // the 3D engine faces local +Z
    tx: dx / length,
    tz: dz / length,
    angle: t,
    route: "main",
  };
}

// Construct the new detour from the original junctions. A departure and
// return straight share the exact heading of the main line at each turnout.
const departure = mainPose(BRANCH_START);
const arrival = mainPose(BRANCH_END);
const departureStraightEnd = {
  x: departure.x + departure.tx * 8,
  z: departure.z + departure.tz * 8,
};
const arrivalStraightStart = {
  x: arrival.x - arrival.tx * 8,
  z: arrival.z - arrival.tz * 8,
};
const outerNorth = { x: BRANCH_OUTWARD, z: 10 };
const outerSouth = { x: BRANCH_OUTWARD, z: -10 };
const branchSegments = [
  { kind: "straight", points: [departure, departureStraightEnd] },
  {
    kind: "curve",
    points: [
      departureStraightEnd,
      {
        x: departureStraightEnd.x + departure.tx * 7,
        z: departureStraightEnd.z + departure.tz * 7,
      },
      { x: BRANCH_OUTWARD, z: 17 },
      outerNorth,
    ],
  },
  { kind: "straight", points: [outerNorth, outerSouth] },
  {
    kind: "curve",
    points: [
      outerSouth,
      { x: BRANCH_OUTWARD, z: -17 },
      {
        x: arrivalStraightStart.x - arrival.tx * 7,
        z: arrivalStraightStart.z - arrival.tz * 7,
      },
      arrivalStraightStart,
    ],
  },
  { kind: "straight", points: [arrivalStraightStart, arrival] },
];

function evaluateSegment(segment, u) {
  const t = Math.max(0, Math.min(1, u));
  const [a, b, c, d] = segment.points;
  if (segment.kind === "straight") {
    return {
      x: a.x + (b.x - a.x) * t,
      z: a.z + (b.z - a.z) * t,
      dx: b.x - a.x,
      dz: b.z - a.z,
    };
  }

  const v = 1 - t;
  return {
    x: v ** 3 * a.x + 3 * v * v * t * b.x + 3 * v * t * t * c.x + t ** 3 * d.x,
    z: v ** 3 * a.z + 3 * v * v * t * b.z + 3 * v * t * t * c.z + t ** 3 * d.z,
    dx: 3 * v * v * (b.x - a.x) + 6 * v * t * (c.x - b.x) + 3 * t * t * (d.x - c.x),
    dz: 3 * v * v * (b.z - a.z) + 6 * v * t * (c.z - b.z) + 3 * t * t * (d.z - c.z),
  };
}

// Arc-length lookup tables avoid lurching through curved portions. There are
// only five sections, so each pose query uses one tiny binary search.
const measuredSegments = [];
let accumulatedLength = 0;
for (const segment of branchSegments) {
  const samples = [{ u: 0, distance: 0 }];
  let last = evaluateSegment(segment, 0);
  let length = 0;
  const sampleCount = segment.kind === "straight" ? 1 : 120;
  for (let i = 1; i <= sampleCount; i += 1) {
    const u = i / sampleCount;
    const point = evaluateSegment(segment, u);
    length += Math.hypot(point.x - last.x, point.z - last.z);
    samples.push({ u, distance: length });
    last = point;
  }
  measuredSegments.push({ segment, samples, start: accumulatedLength, length });
  accumulatedLength += length;
}
export const BRANCH_LENGTH = accumulatedLength;

function branchAngleAtDistance(distance) {
  return BRANCH_START + (BRANCH_END - BRANCH_START) * distance / BRANCH_LENGTH;
}

// The station is centred on the completely straight, 20-unit outer section.
export const BRANCH_STATION_ANGLE = branchAngleAtDistance(
  measuredSegments[2].start + measuredSegments[2].length / 2,
);

// Explicit straight ranges make it possible to verify their geometry.
export const BRANCH_STRAIGHTS = [0, 2, 4].map((index) => ({
  start: branchAngleAtDistance(measuredSegments[index].start),
  end: branchAngleAtDistance(measuredSegments[index].start + measuredSegments[index].length),
  length: measuredSegments[index].length,
}));

function mainSectionLength() {
  let total = 0;
  let last = mainPose(BRANCH_START);
  const steps = 500;
  for (let i = 1; i <= steps; i += 1) {
    const point = mainPose(BRANCH_START + (BRANCH_END - BRANCH_START) * i / steps);
    total += Math.hypot(point.x - last.x, point.z - last.z);
    last = point;
  }
  return total;
}

export const MAIN_SECTION_LENGTH = mainSectionLength();
// The longer branch takes longer to traverse, rather than making the train
// suddenly rush through its station to reach the junction at the old time.
export const BRANCH_SPEED_FACTOR = MAIN_SECTION_LENGTH / BRANCH_LENGTH;

function branchPose(angle) {
  const t = normaliseAngle(angle);
  const distance = (t - BRANCH_START) / (BRANCH_END - BRANCH_START) * BRANCH_LENGTH;
  const measured = measuredSegments.find((item) => distance <= item.start + item.length)
    || measuredSegments.at(-1);
  const localDistance = Math.min(measured.length, Math.max(0, distance - measured.start));
  const samples = measured.samples;
  let low = 0;
  let high = samples.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >> 1;
    if (samples[mid].distance < localDistance) low = mid;
    else high = mid;
  }
  const earlier = samples[low];
  const later = samples[high];
  const fraction = later.distance > earlier.distance
    ? (localDistance - earlier.distance) / (later.distance - earlier.distance) : 0;
  const u = earlier.u + (later.u - earlier.u) * fraction;
  const point = evaluateSegment(measured.segment, u);
  const length = Math.hypot(point.dx, point.dz);
  return {
    x: point.x,
    y: 0.22,
    z: point.z,
    heading: Math.atan2(point.dx, point.dz),
    tx: point.dx / length,
    tz: point.dz / length,
    angle: t,
    route: "branch",
  };
}

export function getTrackPose(angle, route = "main") {
  const t = normaliseAngle(angle);
  return route === "branch" && isOnBranchSection(t)
    ? branchPose(t)
    : mainPose(t);
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
  // Changing points during a branch journey applies to the next trip.
  let active = state.branchTrip;
  let entered = false;
  if (crossesAngle(previousAngle, currentAngle, BRANCH_START)) {
    active = state.branchSelected;
    entered = active;
  }
  if (active && crossesAngle(previousAngle, currentAngle, BRANCH_END + WAGON_OFFSETS.at(-1))) {
    active = false; // rear carriage has cleared the second junction
  }
  return { branchTrip: active, entered };
}
