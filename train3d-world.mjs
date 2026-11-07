import * as THREE from "three";
import {
  TAU, BRANCH_START, BRANCH_END,
  getTrackPose, bridgeLift,
} from "./train3d-track.mjs";

const brown = new THREE.MeshStandardMaterial({ color: 0x94603b, roughness: 0.82 });
const sleepers = new THREE.MeshStandardMaterial({ color: 0xc79153, roughness: 0.78 });
const railWood = new THREE.MeshStandardMaterial({ color: 0x79502e, roughness: 0.65 });
const railTop = new THREE.MeshStandardMaterial({ color: 0xe9c28c, roughness: 0.46 });
const grass = new THREE.MeshStandardMaterial({ color: 0x84c76d, roughness: 0.95 });
const darkGreen = new THREE.MeshStandardMaterial({ color: 0x367b46, roughness: 0.93 });
const leafGreen = new THREE.MeshStandardMaterial({ color: 0x58b36a, roughness: 0.89 });
const golden = new THREE.MeshStandardMaterial({ color: 0xfad05d, roughness: 0.51 });
const cream = new THREE.MeshStandardMaterial({ color: 0xffedbc, roughness: 0.85 });
const blue = new THREE.MeshStandardMaterial({ color: 0x88d9ee, roughness: 0.4 });
const red = new THREE.MeshStandardMaterial({ color: 0xba4840, roughness: 0.65 });

function mesh(parent, shape, material, x, y, z) {
  const object = new THREE.Mesh(shape, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function block(parent, x, y, z, dx, dy, dz, material) {
  return mesh(parent, new THREE.BoxGeometry(dx, dy, dz), material, x, y, z);
}

function railPoint(t, side, route) {
  const p = getTrackPose(t, route);
  // The track is local to the tangent of the curve, not an image overlay.
  return new THREE.Vector3(
    p.x + Math.cos(p.heading) * side,
    p.y + 0.17,
    p.z - Math.sin(p.heading) * side,
  );
}

function drawRails(group, route) {
  const isBranch = route === "branch";
  const start = isBranch ? BRANCH_START : 0;
  const end = isBranch ? BRANCH_END : TAU;
  const count = isBranch ? 108 : 280;
  const closed = !isBranch;

  for (const side of [-1.14, 1.14]) {
    const points = [];
    const highlight = [];
    for (let i = 0; i <= count; i++) {
      const t = start + (end - start) * i / count;
      const rail = railPoint(t, side, route);
      points.push(rail);
      highlight.push(rail.clone().add(new THREE.Vector3(0, 0.07, 0)));
    }
    // CatmullRomCurve3 creates a continuous three-dimensional curved rail.
    // Keep the branch endpoints coincident with the main line's two turnouts.
    const curve = new THREE.CatmullRomCurve3(closed ? points.slice(0, -1) : points, closed, "centripetal");
    const topCurve = new THREE.CatmullRomCurve3(closed ? highlight.slice(0, -1) : highlight, closed, "centripetal");
    const rail = mesh(group, new THREE.TubeGeometry(curve, count, 0.13, 8, closed), railWood, 0, 0, 0);
    const stripe = mesh(group, new THREE.TubeGeometry(topCurve, count, 0.052, 6, closed), railTop, 0, 0, 0);
    rail.castShadow = true;
    stripe.castShadow = false;
  }

  const tieCount = isBranch ? 38 : 113;
  const tieMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(3.45, 0.18, 0.62), sleepers, tieCount);
  tieMesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  for (let index = 0; index < tieCount; index++) {
    const t = start + (end - start) * index / tieCount;
    const pose = getTrackPose(t, route);
    dummy.position.set(pose.x, pose.y + 0.04, pose.z);
    dummy.rotation.set(0, pose.heading, 0);
    dummy.updateMatrix();
    tieMesh.setMatrixAt(index, dummy.matrix);
  }
  tieMesh.instanceMatrix.needsUpdate = true;
  group.add(tieMesh);
}

function drawBridge(group) {
  // The rail at parameter 0 is physically above the rail at PI.
  for (let i = 0; i < 20; i++) {
    const t = -0.43 + i * 0.044;
    const p = getTrackPose(t);
    const deck = block(group, p.x, p.y - 0.22, p.z, 3.85, 0.35, 1.75, sleepers);
    deck.rotation.y = p.heading;
  }
  for (const t of [-0.28, -0.12, 0.12, 0.28]) {
    const p = getTrackPose(t);
    const height = Math.max(0.2, bridgeLift(t) - 0.1);
    for (const side of [-1.55, 1.55]) {
      const post = block(group, p.x + Math.cos(p.heading) * side, height / 2, p.z - Math.sin(p.heading) * side, 0.42, height, 0.42, brown);
      post.rotation.y = p.heading;
    }
  }
}

function makeTree(parent, x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  parent.add(group);
  mesh(group, new THREE.CylinderGeometry(0.31 * scale, 0.40 * scale, 1.7 * scale, 9), brown, 0, 0.85 * scale, 0);
  for (const [y, radius] of [[1.8, 1.65], [2.7, 1.28], [3.55, 0.86]]) {
    mesh(group, new THREE.ConeGeometry(radius * scale, 2.55 * scale, 8), y === 3.55 ? leafGreen : darkGreen, 0, y * scale, 0);
  }
}

function makeStation(parent, x, z, titleColor = red) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  parent.add(group);
  block(group, 0, 0.20, 0, 8.8, 0.4, 5.2, brown);
  block(group, 0, 2.0, 0, 6.2, 3.6, 3.8, cream);
  const roof = mesh(group, new THREE.ConeGeometry(4.7, 2.4, 4), titleColor, 0, 4.75, 0);
  roof.rotation.y = Math.PI / 4;
  for (const dx of [-2, 2]) {
    block(group, dx, 2.5, 1.95, 1.0, 1.2, 0.10, blue);
    block(group, dx, 2.5, 2.02, 0.12, 1.24, 0.17, brown);
  }
  block(group, 0, 1.36, 2.0, 1.5, 2.0, 0.12, brown);
  block(group, 0, 3.82, 2.04, 3.2, 0.45, 0.12, titleColor);
  return group;
}

function makeSignal(parent, pose, side) {
  const x = pose.x + side * Math.cos(pose.heading) * 3.5;
  const z = pose.z - side * Math.sin(pose.heading) * 3.5;
  mesh(parent, new THREE.CylinderGeometry(0.15, 0.19, 4, 10), brown, x, 2, z);
  block(parent, x, 4.20, z, 0.88, 1.75, 0.35, new THREE.MeshStandardMaterial({color:0x2a303a}));
  mesh(parent, new THREE.SphereGeometry(0.23, 12, 10), new THREE.MeshStandardMaterial({color:0xff554c,emissive:0xaa211b,emissiveIntensity:0.48}), x, 4.65, z + 0.23);
  mesh(parent, new THREE.SphereGeometry(0.23, 12, 10), new THREE.MeshStandardMaterial({color:0x56dc76,emissive:0x164e22,emissiveIntensity:0.5}), x, 3.95, z + 0.23);
}

function makeSwitch(parent) {
  const p = getTrackPose(BRANCH_START);
  const post = block(parent, p.x + 2.0, 1.05, p.z - 2.0, 0.42, 2.1, 0.42, brown);
  post.rotation.y = p.heading;
  const marker = mesh(parent, new THREE.SphereGeometry(0.64, 16, 10), golden, p.x + 2.0, 2.3, p.z - 2.0);
  return marker;
}

function addTracksideProps(parent) {
  makeStation(parent, -11.5, -15.9, red);
  makeStation(parent, 27.8, -5.0, new THREE.MeshStandardMaterial({color:0x6d9ce0,roughness:0.7}));
  makeSignal(parent, getTrackPose(0.98), -1);
  makeSignal(parent, getTrackPose(5.63), 1);
  for (const x of [-34, -29, -25, 26, 31, 35]) {
    for (const z of [-23, 20]) {
      makeTree(parent, x, z, 0.65 + ((x * x + z * z) % 7) * 0.045);
    }
  }
  for (const [x, z] of [[-17,19],[-9,18],[6,-19],[12,-22],[28,15],[33,5],[-33,8],[-31,-8],[2,22]]) {
    makeTree(parent, x, z, 0.66 + Math.abs(x + z) % 5 * 0.075);
  }
  // Soft-edged painted wooden building blocks across the toy play table.
  const blocks = [[-20,-11,0x67a5d8], [24,10,0xea8e53], [0,-20,0xf1be54]];
  blocks.forEach(([x,z,color]) => {
    const material = new THREE.MeshStandardMaterial({color,roughness:0.68});
    const body = block(parent,x,1.25,z,2.7,2.5,2.7,material);
    body.rotation.y = 0.16;
    const roof = mesh(parent,new THREE.ConeGeometry(2.2,1.45,4),brown,x,3.0,z);
    roof.rotation.y = Math.PI/4;
  });
}

export function createToyRailway(scene) {
  scene.background = new THREE.Color(0xa9e6ff);
  scene.fog = new THREE.Fog(0xbdeaff, 85, 165);
  scene.add(new THREE.HemisphereLight(0xdff5ff, 0x7b9865, 2.2));
  const sun = new THREE.DirectionalLight(0xfff1d4, 2.5);
  sun.position.set(-24, 52, 19);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -48;
  sun.shadow.camera.right = 48;
  sun.shadow.camera.top = 42;
  sun.shadow.camera.bottom = -42;
  sun.shadow.bias = -0.00012;
  scene.add(sun);

  const world = new THREE.Group();
  scene.add(world);
  // Wooden board with a real 3D grassy upper surface and timber sides.
  block(world, 0, -0.65, 0, 82, 1.0, 58, brown);
  const field = mesh(world, new THREE.PlaneGeometry(82, 58), grass, 0, -0.12, 0);
  field.rotation.x = -Math.PI / 2;
  field.castShadow = false;
  field.receiveShadow = true;
  drawRails(world, "main");
  drawRails(world, "branch");
  drawBridge(world);
  addTracksideProps(world);
  const switchLight = makeSwitch(world);

  for (const [x,y,z,s] of [[-22,20,-17,1], [3,24,-29,0.75], [32,21,6,0.85]]) {
    const cloud = new THREE.Group();
    cloud.position.set(x,y,z);
    world.add(cloud);
    const white = new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
    for (const [cx,cy,r] of [[-2,0,1.8],[0,0.8,2.1],[2.3,0.1,1.6]]) {
      const puff = mesh(cloud,new THREE.SphereGeometry(r*s,12,9),white,cx*s,cy*s,0);
      puff.castShadow = false;
    }
  }
  return {
    setBranchSelected(value) {
      switchLight.material = value
        ? new THREE.MeshStandardMaterial({color:0x66f26f,emissive:0x2d993e,emissiveIntensity:0.45})
        : golden;
    },
  };
}
