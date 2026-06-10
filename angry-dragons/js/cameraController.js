import * as THREE from 'three';
import { damp } from './util.js';

// Cinematic chase camera: trails behind and above the dragon with smoothing,
// widens FOV at high speed, and shakes briefly on damage.
let camera = null;
const smoothPos = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const SHAKE_DURATION = 0.45;
let shakeT = 0;
let shakeMag = 0;

export const cameraCtl = {
  init(cam, player) {
    camera = cam;
    smoothPos.set(player.position.x, player.position.y + 3.2, player.position.z + 11);
    camera.position.copy(smoothPos);
    camera.lookAt(player.position.x, player.position.y, player.position.z - 16);
  },

  shake(mag = 0.6) {
    shakeT = SHAKE_DURATION;
    shakeMag = mag;
  },

  update(dt, player) {
    const dx = player.position.x * 0.9; // slight lag toward center for a wider feel
    smoothPos.x = damp(smoothPos.x, dx, 4.5, dt);
    smoothPos.y = damp(smoothPos.y, player.position.y + 3.2, 4.5, dt);
    smoothPos.z = damp(smoothPos.z, player.position.z + 11, 9, dt);
    camera.position.copy(smoothPos);

    if (shakeT > 0) {
      shakeT -= dt;
      const k = Math.max(shakeT / SHAKE_DURATION, 0) * shakeMag;
      camera.position.x += (Math.random() * 2 - 1) * k;
      camera.position.y += (Math.random() * 2 - 1) * k;
    }

    lookTarget.set(player.position.x, player.position.y + 0.8, player.position.z - 16);
    camera.lookAt(lookTarget);

    const targetFov = player.speedActive ? 84 : 72;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov = damp(camera.fov, targetFov, 4, dt);
      camera.updateProjectionMatrix();
    }
  },
};
