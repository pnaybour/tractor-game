import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { makeLocomotive, makeWagon } from "./train3d-model.mjs";

// Original, locally hosted glTF 2.0 assets with named wheel and eye pivots.
// Models can be replaced with Blender-exported GLB without changing track code.
const ASSET_DIR = new URL("./assets/models/", import.meta.url);
const LOCO_URL = new URL("bluebell-tank-engine.gltf", ASSET_DIR).href;
const COACH_URL = new URL("storybook-coach.gltf", ASSET_DIR).href;

function addShadowsAndCollectWheels(root) {
  const wheels = [];
  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = true;
    }
    // glTFLoader may represent an empty pivot as Object3D rather than Group.
    // Both support rotation; only the preserved node name matters.
    if (/^wheel_/.test(object.name)) wheels.push(object);
  });
  return wheels;
}

function coachVariant(root, colour) {
  // Cloned carriages share geometry, but painted panels get a distinct material.
  root.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    const material = object.material;
    if (material.name?.includes("Coach crimson enamel")) {
      object.material = material.clone();
      object.material.color.setHex(colour);
    }
  });
}

export async function loadStorybookTrain() {
  const loader = new GLTFLoader();
  try {
    const [loco, coach] = await Promise.all([
      loader.loadAsync(LOCO_URL),
      loader.loadAsync(COACH_URL),
    ]);
    const engineRoot = loco.scene;
    engineRoot.name = "Bluebell – original friendly blue tank engine";
    const engine = {
      group: engineRoot,
      wheels: addShadowsAndCollectWheels(engineRoot),
      eyes: [engineRoot.getObjectByName("eye_left"), engineRoot.getObjectByName("eye_right")].filter(Boolean),
      smokePoint: new THREE.Vector3(0, 3.05, 1.45),
    };
    const firstCoach = coach.scene;
    const secondCoach = coach.scene.clone(true);
    firstCoach.name = "Red storybook passenger coach";
    secondCoach.name = "Green storybook passenger coach";
    coachVariant(secondCoach, 0x4fa365);
    const wagons = [firstCoach, secondCoach].map((root) => ({
      group: root,
      wheels: addShadowsAndCollectWheels(root),
    }));
    if (engine.wheels.length < 4 || wagons.some((wagon) => wagon.wheels.length < 4) || engine.eyes.length !== 2) {
      throw new Error("glTF models are missing wheel pivots or facial features");
    }
    return { engine, wagons, format: "gltf" };
  } catch (error) {
    console.warn("Could not load storybook glTF models; using basic 3D fallback.", error);
    const engine = { ...makeLocomotive(), eyes: [] };
    return {
      engine,
      wagons: [makeWagon(0x4593d4, "blocks"), makeWagon(0x9a65c1, "logs")],
      format: "fallback",
    };
  }
}
