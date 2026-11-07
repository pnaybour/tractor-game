import * as THREE from "three";
import { BRANCH_STATION_ANGLE, getTrackPose } from "./train3d-track.mjs";

// A real 3D station positioned beside the branch's long straight section.
const stone = new THREE.MeshStandardMaterial({color:0xf2e5c4,roughness:0.93});
const paving = new THREE.MeshStandardMaterial({color:0xe8d1a5,roughness:0.92});
const yellow = new THREE.MeshStandardMaterial({color:0xffe6a7,roughness:0.73});
const blue = new THREE.MeshStandardMaterial({color:0x3577b2,roughness:0.48});
const roof = new THREE.MeshStandardMaterial({color:0x234f7e,roughness:0.6});
const brick = new THREE.MeshStandardMaterial({color:0xe8ba91,roughness:0.91});
const windowGlass = new THREE.MeshStandardMaterial({color:0xa6e6ef,roughness:0.27});
const wood = new THREE.MeshStandardMaterial({color:0x94603b,roughness:0.8});

function place(group, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function block(group, x, y, z, sx, sy, sz, material) {
  return place(group,new THREE.BoxGeometry(sx,sy,sz),material,x,y,z);
}

function makeNameBoard(group, x, z) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 144;
  const context = canvas.getContext("2d");
  context.fillStyle = "#144f81";
  context.fillRect(0,0,640,144);
  context.lineWidth = 10;
  context.strokeStyle = "#fff1c5";
  context.strokeRect(9,9,622,126);
  context.fillStyle = "#fff9dd";
  context.font = "bold 65px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("BLUEBELL HALT",320,73);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const board = place(group,new THREE.PlaneGeometry(5.2,1.18),
    new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}),
    x,2.43,z);
  board.rotation.y = -Math.PI/2; // faces the line to the west
  for (const dz of [-1.85,1.85]) {
    block(group,x,1.20,z+dz,.18,2.40,.18,blue);
  }
}

export function makeBranchStation(parent) {
  const pose = getTrackPose(BRANCH_STATION_ANGLE,"branch");
  const group = new THREE.Group();
  group.name = "Bluebell Halt branch station";
  parent.add(group);
  const x = pose.x;
  const z = pose.z;

  // Platform parallel to the 20-unit north-south branch straight.
  // The inside edge is x+2.3, safely beyond the outer rail at x+1.14.
  block(group,x+4.8,.20,z,5,.42,16,stone);
  block(group,x+4.8,.45,z,5,.08,15.8,paving);
  block(group,x+2.42,.52,z,.16,.045,15.6,yellow);

  // Station house, windows and a central entrance facing the track.
  const houseX=x+10.55;
  block(group,houseX,2.12,z,5.4,3.72,9,brick);
  block(group,houseX,4.18,z,6,.50,10.2,roof);
  block(group,houseX,4.48,z,5.5,.12,9.5,blue);
  for (const dz of [-2.65,2.65]) {
    block(group,houseX-2.76,2.14,z+dz,.075,1.65,1.35,windowGlass);
    block(group,houseX-2.84,1.30,z+dz,.12,.10,1.54,stone);
    block(group,houseX-2.86,2.14,z+dz,.13,1.77,.10,blue);
  }
  block(group,houseX-2.81,1.35,z,.12,2.6,1.65,blue);
  block(group,houseX-2.93,1.52,z+.5,.14,.12,.12,yellow);

  // A short awning shelter with three pillars.
  for (const dz of [-5.5,0,5.5]) {
    block(group,x+6,1.52,z+dz,.19,3.04,.19,blue);
  }
  block(group,x+5.1,3.12,z,3.2,.24,13.4,blue);
  block(group,x+5.1,3.29,z,3.4,.14,13.65,roof);

  // Benches and two spherical platform lamps.
  for (const dz of [-4.6,4.6]) {
    block(group,x+6.28,.78,z+dz,.58,.16,1.6,wood);
    block(group,x+6.54,1.15,z+dz,.12,.73,1.6,wood);
    place(group,new THREE.CylinderGeometry(.09,.12,4,10),
      blue,x+3.10,2.05,z+dz);
    const globe=place(group,new THREE.SphereGeometry(.32,14,10),
      yellow,x+3.10,4.19,z+dz);
    globe.castShadow=false;
  }

  makeNameBoard(group,x+4.9,z-4.7);
  return group;
}
