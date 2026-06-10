import * as THREE from 'three';
import { damp } from './util.js';

// Chase camera: smooth follow, FOV widens on speed, shakes on damage/crash,
// kicks harder on boost start, tightens during fever.
let camera = null;
const smoothPos = new THREE.Vector3();
const lookTarget = new THREE.Vector3();

const SHAKE_DURATION = 0.45;
let shakeT = 0;
let shakeMag = 0;

// Boost kick: brief forward lurch + FOV spike on boost start
let boostKickT = 0;
const BOOST_KICK_DUR = 0.35;

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

  boostKick() {
    boostKickT = BOOST_KICK_DUR;
  },

  update(dt, player) {
    const dx = player.position.x * 0.9;
    smoothPos.x = damp(smoothPos.x, dx,                    4.5, dt);
    smoothPos.y = damp(smoothPos.y, player.position.y + 3.2, 4.5, dt);
    smoothPos.z = damp(smoothPos.z, player.position.z + 11,  9,   dt);
    camera.position.copy(smoothPos);

    // Boost kick: camera pulls back slightly then snaps forward
    if (boostKickT > 0) {
      boostKickT -= dt;
      const k = (boostKickT / BOOST_KICK_DUR);
      // Push back on start, then settle — gives "punch" feel
      camera.position.z += Math.sin(k * Math.PI) * 2.2;
      camera.position.y += Math.sin(k * Math.PI) * 0.5;
    }

    if (shakeT > 0) {
      shakeT -= dt;
      const k = Math.max(shakeT / SHAKE_DURATION, 0) * shakeMag;
      camera.position.x += (Math.random() * 2 - 1) * k;
      camera.position.y += (Math.random() * 2 - 1) * k;
    }

    lookTarget.set(player.position.x, player.position.y + 0.8, player.position.z - 16);
    camera.lookAt(lookTarget);

    // FOV: base 72, boost → 90, fever → 94 (wider = more intense)
    let targetFov = 72;
    if (player.speedActive) targetFov = 90;
    if (player.feverActive) targetFov = 94;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov = damp(camera.fov, targetFov, player.boosting ? 5 : 3, dt);
      camera.updateProjectionMatrix();
    }
  },
};
