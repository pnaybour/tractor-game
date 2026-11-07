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
  // Soft rounded storybook trees rather than sharp toy conifers.
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  parent.add(group);
  mesh(group, new THREE.CylinderGeometry(0.31 * scale, 0.44 * scale, 2.5 * scale, 10), brown, 0, 1.2 * scale, 0);
  const crown = [
    [-0.9, 2.6, 0.1, 1.3], [0.7, 2.7, -0.2, 1.42],
    [0.1, 3.38, 0.15, 1.5], [-0.25, 2.45, 0.5, 1.24],
  ];
  crown.forEach(([cx, cy, cz, radius], index) => {
    mesh(group, new THREE.SphereGeometry(radius * scale, 13, 10),
      index % 2 ? leafGreen : darkGreen,
      cx * scale, cy * scale, cz * scale);
  });
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

function makeStorybookLandscape(parent) {
  // Puffy green hills in the distance give the scene a picture-book setting.
  const hills = [
    {x:-28,z:-35,rx:19,ry:6,rz:12}, {x:2,z:-41,rx:25,ry:9,rz:13},
    {x:33,z:-39,rx:19,ry:7,rz:14}, {x:-36,z:30,rx:14,ry:5,rz:8},
  ];
  const hillPaint = new THREE.MeshStandardMaterial({color:0x75bd70,roughness:1});
  hills.forEach(({x,z,rx,ry,rz}) => {
    const hill = mesh(parent,new THREE.SphereGeometry(1,22,12),hillPaint,x,-1.5,z);
    hill.scale.set(rx,ry,rz);
    hill.castShadow = false;
  });

  // White rail fences, small hedgerows and bright flowers mark out the toy land.
  const fencePaint = new THREE.MeshStandardMaterial({color:0xfff2d9,roughness:0.76});
  for (const z of [-25.0,25.0]) {
    for (let x=-35; x<=35; x+=7) {
      block(parent,x,0.65,z,0.20,1.5,0.20,fencePaint);
      if (x<35) {
        block(parent,x+3.5,1.08,z,7.05,0.14,0.16,fencePaint);
        block(parent,x+3.5,0.53,z,7.05,0.13,0.16,fencePaint);
      }
    }
  }

  const flowerColours = [
    new THREE.MeshStandardMaterial({color:0xffd558,roughness:.82}),
    new THREE.MeshStandardMaterial({color:0xf18bc0,roughness:.82}),
    new THREE.MeshStandardMaterial({color:0xffe8ed,roughness:.82}),
    new THREE.MeshStandardMaterial({color:0x9baff1,roughness:.82}),
  ];
  const leafPaint = new THREE.MeshStandardMaterial({color:0x4da965,roughness:.95});
  for (let i=0;i<32;i++) {
    const x=-32+(i*19%64);
    const z=17+(i*7%7);
    const flower = mesh(parent,new THREE.SphereGeometry(0.26,8,6),
      flowerColours[i%flowerColours.length],x,0.26,z);
    flower.castShadow = false;
    mesh(parent,new THREE.CylinderGeometry(.04,.05,.36,6),leafPaint,x,0.06,z);
  }

  // A cheerful miniature water tower beside the branch platform.
  const stone = new THREE.MeshStandardMaterial({color:0xf4e1bb,roughness:.9});
  mesh(parent,new THREE.CylinderGeometry(.84,.98,4.3,14),stone,31.5,2.25,-18.4);
  mesh(parent,new THREE.CylinderGeometry(1.38,1.38,1.32,20),new THREE.MeshStandardMaterial({color:0xbd4942,roughness:.64}),31.5,4.98,-18.4);
  mesh(parent,new THREE.ConeGeometry(1.52,.72,16),brown,31.5,6.05,-18.4);
}

function addTracksideProps(parent) {
  makeStation(parent, -11.5, -15.9, red);
  makeStation(parent, 33.5, -9.0, new THREE.MeshStandardMaterial({color:0x6d9ce0,roughness:0.7}));
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
  scene.background = new THREE.Color(0xb8e9ff);
  scene.fog = new THREE.Fog(0xd0f3ff, 95, 185);
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
  makeStorybookLandscape(world);
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
