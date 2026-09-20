import { useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { filmDriver } from '../filmDriver';
import { CAMERA_DAMP_LAMBDA, RENDER_EPSILON, sampleTimeline } from '../timeline';

const desiredPosition = new THREE.Vector3();
const desiredTarget = new THREE.Vector3();

/**
 * Applies the deterministic film timeline to the physical camera.
 *
 * Scroll position is the single source of truth: fast or large scroll input
 * can only move `targetT`, and the visible camera approaches that target
 * exponentially, so the film cannot jump — and nothing ever holds it back.
 * There is no checkpoint, no dwell timer, and no forced pause; the laptop
 * opens and the film continues immediately.
 */
export default function CameraRig(): null {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    filmDriver.notify = () => invalidate();
    invalidate();
    return () => {
      if (filmDriver.notify) {
        filmDriver.notify = null;
      }
    };
  }, [invalidate]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(Math.max(rawDelta, 0), 0.05);

    filmDriver.currentT = THREE.MathUtils.damp(
      filmDriver.currentT,
      filmDriver.targetT,
      CAMERA_DAMP_LAMBDA,
      delta,
    );

    const film = sampleTimeline(filmDriver.currentT);
    desiredPosition.set(
      film.camera.position[0],
      film.camera.position[1],
      film.camera.position[2],
    );
    desiredTarget.set(film.camera.target[0], film.camera.target[1], film.camera.target[2]);

    camera.position.copy(desiredPosition);
    camera.lookAt(desiredTarget);
    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - film.camera.fov) > 0.001) {
      camera.fov = film.camera.fov;
      camera.updateProjectionMatrix();
    }

    // Settle against the scroll target so the demand loop sleeps until the
    // next scroll input wakes it.
    if (Math.abs(filmDriver.targetT - filmDriver.currentT) > RENDER_EPSILON) {
      invalidate();
    } else {
      filmDriver.currentT = filmDriver.targetT;
    }
  });

  return null;
}
