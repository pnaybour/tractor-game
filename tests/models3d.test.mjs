import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ASSET_PATHS = [
  "../assets/models/bluebell-tank-engine.gltf",
  "../assets/models/storybook-coach.gltf",
];

async function readAsset(relativePath) {
  const raw = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const gltf = JSON.parse(raw);
  assert.equal(gltf.asset.version, "2.0");
  assert.ok(gltf.scenes.length > 0);
  assert.ok(gltf.meshes.length > 0);
  assert.ok(gltf.buffers.length > 0);
  assert.match(gltf.buffers[0].uri, /^data:application\/octet-stream;base64,/);
  const binary = Buffer.from(gltf.buffers[0].uri.split(",")[1], "base64");
  assert.equal(binary.length, gltf.buffers[0].byteLength);
  for (const accessor of gltf.accessors) {
    const view = gltf.bufferViews[accessor.bufferView];
    assert.ok(view, "Each accessor must reference a buffer view");
    assert.equal(view.byteOffset % 4, 0);
    assert.ok(view.byteOffset + view.byteLength <= binary.length);
  }
  for (const node of gltf.nodes) {
    if (node.mesh !== undefined) assert.ok(node.mesh < gltf.meshes.length);
    for (const child of node.children || []) assert.ok(child < gltf.nodes.length);
  }
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    const pos = gltf.accessors[primitive.attributes.POSITION];
    const norm = gltf.accessors[primitive.attributes.NORMAL];
    assert.equal(pos.type, "VEC3");
    assert.equal(norm.count, pos.count);
    const indices = gltf.accessors[primitive.indices];
    assert.equal(indices.type, "SCALAR");
    assert.ok(indices.count >= 3);
  }
  return gltf;
}

test("original 3D locomotive and coaches are valid self-contained glTF models", async () => {
  for (const path of ASSET_PATHS) {
    const gltf = await readAsset(path);
    const wheels = gltf.nodes.filter((n) => n.name?.startsWith("wheel_"));
    assert.ok(wheels.length >= 4, path + " must have named animated wheel pivots");
    assert.ok(gltf.materials.length > 5);
    assert.ok(gltf.nodes.length > 25);
  }
});

test("storybook tank engine has both named animated eyes and expressive face", async () => {
  const gltf = await readAsset(ASSET_PATHS[0]);
  const names = gltf.nodes.map((node) => node.name);
  assert.ok(names.includes("eye_left"));
  assert.ok(names.includes("eye_right"));
  assert.ok(names.includes("smiling grey face disc"));
  assert.ok(names.includes("smiling mouth"));
  assert.ok(gltf.materials.some((material) => material.name.includes("Bright sky-blue")));
});

test("storybook coach has painted body and clear windows", async () => {
  const gltf = await readAsset(ASSET_PATHS[1]);
  const names = gltf.nodes.map((node) => node.name);
  assert.ok(names.includes("sunny lower painted coach"));
  assert.ok(names.includes("shiny carriage window"));
});
