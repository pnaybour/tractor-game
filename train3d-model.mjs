import * as THREE from "three";

// Actual shaded 3D meshes, not a perspective drawing on a canvas.
// All parts belong to articulated scene-graph objects so they can be reused
// or replaced later with a Blender/Kenney glTF model without changing the track.
const wood = new THREE.MeshStandardMaterial({ color: 0xc68c4c, roughness: 0.77 });
const red = new THREE.MeshStandardMaterial({ color: 0xdf4637, roughness: 0.36, metalness: 0.09 });
const darkRed = new THREE.MeshStandardMaterial({ color: 0x8b2926, roughness: 0.58 });
const gold = new THREE.MeshStandardMaterial({ color: 0xffd16f, metalness: 0.23, roughness: 0.37 });
const dark = new THREE.MeshStandardMaterial({ color: 0x282a32, roughness: 0.63 });
const steel = new THREE.MeshStandardMaterial({ color: 0x9da6b0, metalness: 0.65, roughness: 0.34 });
const glass = new THREE.MeshStandardMaterial({ color: 0x92dcee, roughness: 0.15, metalness: 0.06, transparent: true, opacity: 0.78 });
const green = new THREE.MeshStandardMaterial({ color: 0x339d61, roughness: 0.56 });
const light = new THREE.MeshStandardMaterial({ color: 0xfff1ac, emissive: 0xffc766, emissiveIntensity: 0.55 });

function addMesh(group, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function box(group, x, y, z, sx, sy, sz, material) {
  return addMesh(group, new THREE.BoxGeometry(sx, sy, sz), material, x, y, z);
}

function cylinder(group, x, y, z, radiusTop, radiusBottom, length, material, sides = 24) {
  return addMesh(group, new THREE.CylinderGeometry(radiusTop, radiusBottom, length, sides), material, x, y, z);
}

function installWheel(group, x, z, radius = 0.45) {
  const axle = new THREE.Group();
  axle.position.set(x, radius + 0.08, z);
  group.add(axle);
  const tyre = addMesh(axle, new THREE.CylinderGeometry(radius, radius, 0.22, 20), dark, 0, 0, 0);
  tyre.rotation.z = Math.PI / 2;
  const inner = addMesh(axle, new THREE.CylinderGeometry(radius * 0.68, radius * 0.68, 0.235, 16), steel, 0, 0, 0);
  inner.rotation.z = Math.PI / 2;
  const hub = addMesh(axle, new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, 0.25, 12), gold, 0, 0, 0);
  hub.rotation.z = Math.PI / 2;
  for (let index = 0; index < 6; index += 1) {
    const spoke = box(axle, 0, 0, 0, 0.025, radius * 1.18, 0.06, dark);
    spoke.rotation.x = index * Math.PI / 6;
  }
  return axle;
}

function installCoupler(group, endZ) {
  const sign = Math.sign(endZ);
  box(group, 0, 0.44, endZ, 0.52, 0.17, 0.5, dark);
  const coupling = cylinder(group, 0, 0.44, endZ + sign * 0.25, 0.16, 0.16, 0.15, gold, 12);
  coupling.rotation.x = Math.PI / 2;
}

export function makeLocomotive() {
  const root = new THREE.Group();
  root.name = "Red wooden toy steam locomotive";
  const wheels = [];
  // Chassis, footplate and boiler.
  box(root, 0, 0.62, 0, 2.52, 0.50, 4.75, darkRed);
  box(root, 0, 0.95, 0.1, 2.36, 0.18, 4.64, red);
  const boiler = cylinder(root, 0, 1.59, 0.55, 0.72, 0.72, 3.2, red, 32);
  boiler.rotation.x = Math.PI / 2;
  for (const z of [-0.72, 0.43, 1.65]) {
    const ring = cylinder(root, 0, 1.59, z, 0.735, 0.735, 0.12, gold, 32);
    ring.rotation.x = Math.PI / 2;
  }
  // Black smokebox front, lamp and funnel.
  const face = cylinder(root, 0, 1.59, 2.20, 0.70, 0.70, 0.18, dark, 32);
  face.rotation.x = Math.PI / 2;
  addMesh(root, new THREE.SphereGeometry(0.24, 20, 14), light, 0, 1.65, 2.34);
  cylinder(root, 0, 2.36, 1.53, 0.31, 0.25, 0.76, dark);
  const rim = cylinder(root, 0, 2.77, 1.53, 0.40, 0.40, 0.15, gold);
  rim.material = dark;
  // Cab with visible glazed windows and a rounded toy-like roof.
  box(root, 0, 1.85, -1.57, 2.12, 1.75, 1.65, red);
  box(root, 0, 2.81, -1.58, 2.52, 0.22, 2.00, gold);
  box(root, 0, 2.96, -1.58, 2.28, 0.11, 1.75, darkRed);
  for (const side of [-1, 1]) {
    box(root, side * 1.071, 2.03, -1.58, 0.045, 0.78, 0.82, glass);
    box(root, side * 1.10, 1.54, -1.58, 0.08, 0.09, 1.14, gold);
  }
  box(root, 0, 2.10, -0.724, 1.28, 0.75, 0.05, glass);
  box(root, 0, 2.10, -2.42, 1.28, 0.75, 0.05, glass);
  // Little toy driver.
  cylinder(root, 0, 1.58, -1.58, 0.37, 0.37, 0.64, green, 12);
  addMesh(root, new THREE.SphereGeometry(0.28, 16, 12), gold, 0, 2.12, -1.58);
  box(root, 0, 2.39, -1.58, 0.68, 0.15, 0.64, dark);
  // Side wheels and shiny connecting rods.
  for (const x of [-1.24, 1.24]) {
    for (const z of [-1.43, 0.08, 1.55]) {
      wheels.push(installWheel(root, x, z, 0.46));
    }
    box(root, x * 1.02, 0.62, 0.06, 0.08, 0.11, 3.32, steel);
  }
  installCoupler(root, -2.55);
  const pilot = box(root, 0, 0.35, 2.52, 2.3, 0.24, 0.50, gold);
  pilot.rotation.x = -0.10;
  return {
    group: root,
    wheels,
    smokePoint: new THREE.Vector3(0, 2.85, 1.53),
  };
}

export function makeWagon(colorHex, cargo = "blocks") {
  const root = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.48, metalness: 0.07 });
  const wheels = [];
  box(root, 0, 0.62, 0, 2.42, 0.46, 3.74, wood);
  box(root, 0, 0.94, 0, 2.43, 0.25, 3.66, paint);
  for (const x of [-1.02, 1.02]) {
    box(root, x, 1.34, 0, 0.24, 0.80, 3.40, paint);
  }
  for (const z of [-1.63, 1.63]) {
    box(root, 0, 1.34, z, 2.18, 0.80, 0.21, paint);
  }
  const colours = [gold, green, red, steel];
  if (cargo === "blocks") {
    const payload = [
      { x: -0.47, y: 1.24, z: -0.82, size: 0.78, mat: colours[0] },
      { x: 0.45, y: 1.26, z: -0.28, size: 0.89, mat: colours[1] },
      { x: -0.30, y: 1.22, z: 0.81, size: 0.76, mat: colours[2] },
      { x: 0.36, y: 2.03, z: 0.18, size: 0.54, mat: colours[3] },
    ];
    payload.forEach(({x, y, z, size, mat}) => {
      const cube = box(root, x, y, z, size, size, size, mat);
      cube.rotation.y = (x + z) * 0.16;
    });
  } else {
    // Rounded logs in the second wagon.
    for (const x of [-0.50, 0.25, 0.78]) {
      const log = cylinder(root, x, 1.37, 0, 0.28, 0.28, 2.82, wood, 12);
      log.rotation.x = Math.PI / 2;
    }
  }
  for (const x of [-1.13, 1.13]) {
    for (const z of [-1.09, 1.09]) {
      wheels.push(installWheel(root, x, z, 0.43));
    }
  }
  installCoupler(root, -1.99);
  installCoupler(root, 1.99);
  return { group: root, wheels };
}
