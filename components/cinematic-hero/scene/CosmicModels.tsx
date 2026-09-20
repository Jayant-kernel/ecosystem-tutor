import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { filmDriver } from '../filmDriver';
import { smoothstep } from '../timeline';

import earthGlbUrl from '../../../assests/earth.glb?url';
import asteroidsGlbUrl from '../../../assests/asteroids_pack_rocky_version.glb?url';

const EARTH_URL = earthGlbUrl;
const EARTH_TEXTURE_URL = '/cinematic-assets/earth-diffuse.jpg';
const ASTEROIDS_URL = asteroidsGlbUrl;

// Earth tuning: fit ANY earth file to EARTH_RADIUS (measured from its real
// geometry, so source-file scale changes can't shrink or blow it up), then
// sink its center so only the curved top arc crests just below the CTA.
const EARTH_RADIUS = 7.5;
const EARTH_TOP_Y = -1.0;
const EARTH_POSITION: [number, number, number] = [-14, EARTH_TOP_Y - EARTH_RADIUS, 0];
const EARTH_ROTATION: [number, number, number] = [0.05, -0.55, 0];
// Whole-disc purple: multiplies the satellite diffuse so oceans + land read
// violet while keeping texture detail.
const EARTH_PURPLE_TINT = '#9d6bff';

interface AsteroidPlacement {
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  radius: number;
  spin: [number, number, number];
}

// All 10 scanned rocks from the asteroids pack, arranged in the LEFT/RIGHT
// foreground bands. The final camera looks down -X, so Z controls horizontal
// screen placement (screen-right is -Z). Keeping the rocks 5–8 world units
// ahead of the camera, rather than at the far horizon, gives the GLB texture
// enough on-screen area to read while the clear central lane protects the copy.
const ASTEROID_PLACEMENTS: AsteroidPlacement[] = [
  { name: 'Asteroid_no_1', position: [-6.5, 2.9, 4.4], rotation: [0.3, 0.8, -0.25], radius: 1.45, spin: [0.25, 0.4, 0.1] },
  { name: 'Asteroid_no_2', position: [-7.2, 1.3, 4.9], rotation: [0.1, 0.2, 0.4], radius: 1.05, spin: [0.3, 0.25, 0.15] },
  { name: 'Asteroid_no_3', position: [-8.3, 0.0, 4.7], rotation: [0.5, -0.7, 0.15], radius: 1.32, spin: [0.2, 0.5, 0.12] },
  { name: 'Asteroid_no_4', position: [-6.9, 4.0, 4.8], rotation: [-0.3, 0.6, 0.2], radius: 0.88, spin: [0.35, 0.3, 0.2] },
  { name: 'Asteroid_no_5', position: [-8.0, -1.4, 4.5], rotation: [0.6, 0.1, -0.4], radius: 1.18, spin: [0.22, 0.38, 0.14] },
  { name: 'Asteroid_no_6', position: [-8.7, 4.6, 4.1], rotation: [-0.2, 0.3, 0.5], radius: 0.95, spin: [0.28, 0.45, 0.1] },
  { name: 'Asteroid_no_7', position: [-6.8, 3.0, -4.5], rotation: [0.2, -0.4, 0.3], radius: 0.78, spin: [0.32, 0.28, 0.18] },
  { name: 'Asteroid_no_8', position: [-8.1, 1.2, -4.8], rotation: [-0.4, -0.2, 0.1], radius: 1.12, spin: [0.18, 0.35, 0.12] },
  { name: 'Asteroid_no_9', position: [-7.5, 4.5, -4.2], rotation: [0.4, 1.1, -0.35], radius: 0.86, spin: [0.4, 0.32, 0.16] },
  { name: 'Asteroid_no_10', position: [-8.9, -0.4, -4.6], rotation: [0.7, 0.4, 0.0], radius: 1.0, spin: [0.26, 0.42, 0.2] },
];

/** Scale any model so its largest dimension fits the target radius, centered
 * on the origin. Makes placement immune to source-file unit/scale changes. */
function fitToRadius(object: THREE.Object3D, targetRadius: number): void {
  object.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim <= 0) return;
  object.scale.multiplyScalar((targetRadius * 2) / maxDim);
  object.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
  object.position.sub(center);
}

function cloneCentered(source: THREE.Object3D, name: string, targetRadius: number): THREE.Object3D | null {
  const asteroid = source.getObjectByName(name)?.clone(true);
  if (!asteroid) return null;

  fitToRadius(asteroid, targetRadius);
  return asteroid;
}

/** The supplied Earth uses KHR_materials_pbrSpecularGlossiness. Rendering its
 * diffuse map unlit keeps the real satellite texture crisp through the violet
 * atmosphere. The whole disc is tinted purple per design: the violet color
 * multiplies the diffuse map so land + oceans read purple, not blue/green.
 * A null texture (download failed) falls back to flat purple. */
function cloneEarth(source: THREE.Object3D, diffuseMap: THREE.Texture | null): THREE.Object3D {
  const earth = source.clone(true);
  if (diffuseMap) diffuseMap.colorSpace = THREE.SRGBColorSpace;
  earth.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.material = diffuseMap
      ? new THREE.MeshBasicMaterial({ map: diffuseMap, color: EARTH_PURPLE_TINT, fog: true })
      : new THREE.MeshBasicMaterial({ color: '#6d28d9', fog: true });
  });
  fitToRadius(earth, EARTH_RADIUS);
  return earth;
}

function countMeshes(object: THREE.Object3D): number {
  let count = 0;
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) count += 1;
  });
  return count;
}

function disposeScene(scene: THREE.Object3D): void {
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
  });
}

function createStars(): THREE.BufferGeometry {
  const random = (seed: number): number => {
    const value = Math.sin(seed * 91.913) * 10000;
    return value - Math.floor(value);
  };
  const positions = new Float32Array(180 * 3);
  for (let index = 0; index < 180; index++) {
    const offset = index * 3;
    positions[offset] = -5 - random(index * 3 + 1) * 26;
    positions[offset + 1] = -7 + random(index * 3 + 2) * 15;
    positions[offset + 2] = -11 + random(index * 3 + 3) * 22;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

/**
 * Real GLB artwork for the final space act. Models load manually (not via
 * useLoader) so every stage is visible in the console: request → byte
 * progress → parsed contents → placed rocks. Scroll changes the reveal;
 * every asteroid also spins continuously as a true 3D model, so the demand
 * renderer stays awake while the space act is visible.
 */
export default function CosmicModels(): JSX.Element {
  const invalidate = useThree((s) => s.invalidate);
  const rootRef = useRef<THREE.Group | null>(null);
  const earthRef = useRef<THREE.Group | null>(null);
  const asteroidRefs = useRef<Array<THREE.Group | null>>([]);
  const starsMaterialRef = useRef<THREE.PointsMaterial | null>(null);
  const purpleLightRef = useRef<THREE.PointLight | null>(null);
  const asteroidFillRef = useRef<THREE.DirectionalLight | null>(null);
  const [earthData, setEarthData] = useState<{ earth: GLTF; texture: THREE.Texture | null } | null>(null);
  const [rockData, setRockData] = useState<GLTF | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line no-console
    console.info('[cosmic] requesting models:', EARTH_URL, ASTEROIDS_URL);
    const lastPct: Record<'earth' | 'asteroids' | 'texture', number> = { earth: -1, asteroids: -1, texture: -1 };
    const progressOf = (tag: 'earth' | 'asteroids' | 'texture') => (event: ProgressEvent) => {
      if (!event.total) return;
      const pct = Math.floor((event.loaded / event.total) * 100);
      if (pct >= lastPct[tag] + 10 || pct === 100) {
        lastPct[tag] = pct;
        // eslint-disable-next-line no-console
        console.info(`[cosmic] ${tag}: ${pct}% (${(event.loaded / 1048576).toFixed(1)}MB)`);
      }
    };
    const gltfLoader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    // Earth and rocks load INDEPENDENTLY (~22MB vs ~40MB): whichever arrives
    // first renders first instead of Earth waiting on the rocks.
    gltfLoader
      .loadAsync(EARTH_URL, progressOf('earth'))
      .then((earth) =>
        textureLoader
          .loadAsync(EARTH_TEXTURE_URL, progressOf('texture'))
          .catch((error: unknown) => {
            // eslint-disable-next-line no-console
            console.warn('[cosmic] earth texture failed, using flat purple.', error);
            return null;
          })
          .then((texture) => {
            if (cancelled) return;
            // eslint-disable-next-line no-console
            console.info(`[cosmic] earth ready: meshes=${countMeshes(earth.scene)}`);
            setEarthData({ earth, texture });
            invalidate();
          }),
      )
      .catch((error: unknown) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[cosmic] earth load FAILED:', EARTH_URL, error);
      });
    gltfLoader
      .loadAsync(ASTEROIDS_URL, progressOf('asteroids'))
      .then((asteroids) => {
        if (cancelled) return;
        const found = ASTEROID_PLACEMENTS.filter((p) => asteroids.scene.getObjectByName(p.name)).map(
          (p) => p.name,
        );
        // eslint-disable-next-line no-console
        console.info(
          `[cosmic] asteroids ready: ${found.length}/${ASTEROID_PLACEMENTS.length}: ${found.join(', ')}`,
        );
        setRockData(asteroids);
        invalidate();
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[cosmic] asteroids load FAILED:', ASTEROIDS_URL, error);
      });
    return () => {
      cancelled = true;
    };
  }, [invalidate]);

  // Release GPU memory on unmount (e.g. HMR swap). Separate effects per set
  // so one set arriving never disposes the other.
  useEffect(() => {
    if (!earthData) return;
    return () => {
      disposeScene(earthData.earth.scene);
      earthData.texture?.dispose();
    };
  }, [earthData]);
  useEffect(() => {
    if (!rockData) return;
    return () => disposeScene(rockData.scene);
  }, [rockData]);

  const earth = useMemo(() => (earthData ? cloneEarth(earthData.earth.scene, earthData.texture) : null), [earthData]);
  const asteroids = useMemo(
    () =>
      rockData
        ? ASTEROID_PLACEMENTS.map((placement) => ({
            ...placement,
            object: cloneCentered(rockData.scene, placement.name, placement.radius),
          })).filter(
            (asteroid): asteroid is AsteroidPlacement & { object: THREE.Object3D } => asteroid.object !== null,
          )
        : [],
    [rockData],
  );
  const stars = useMemo(createStars, []);

  useEffect(() => () => stars.dispose(), [stars]);

  // Demand renderer draws ONLY on invalidate(). The load callbacks above
  // fire pre-commit, so that invalidate() can land on a frame painted
  // before React commits the new scene graph — after which nothing ever
  // schedules another frame (useFrame only runs DURING frames). Hence models
  // that finish while the film rests never draw until an external invalidate
  // (a scroll pixel, a DevTools resize, …). Re-requesting post-commit
  // guarantees a frame containing the models, and the spin loop in useFrame
  // then sustains itself from there.
  useEffect(() => {
    invalidate();
  }, [earth, asteroids, invalidate]);

  // Dev-only alarm: if a rock name ever stops matching the GLB, say so loudly
  // instead of silently rendering fewer asteroids.
  useEffect(() => {
    if (rockData && asteroids.length !== ASTEROID_PLACEMENTS.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[cosmic] ${asteroids.length}/${ASTEROID_PLACEMENTS.length} asteroids placed; missing:`,
        ASTEROID_PLACEMENTS.filter((p) => !asteroids.some((a) => a.name === p.name)).map((p) => p.name),
      );
    }
  }, [rockData, asteroids]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(Math.max(rawDelta, 0), 0.05);
    const level = smoothstep(0.62, 0.86, filmDriver.currentT);
    const root = rootRef.current;
    if (root) {
      root.visible = level > 0.002;
      const scale = 0.96 + level * 0.04;
      root.scale.setScalar(scale);
    }
    if (starsMaterialRef.current) starsMaterialRef.current.opacity = 0.72 * level;
    if (purpleLightRef.current) purpleLightRef.current.intensity = 8 * level;
    if (asteroidFillRef.current) asteroidFillRef.current.intensity = 2.1 * level;
    // Continuous 3D spin for every asteroid + a slow Earth rotation.
    if (root?.visible) {
      if (earthRef.current) earthRef.current.rotation.y += delta * 0.12;
      asteroids.forEach((asteroid, index) => {
        const group = asteroidRefs.current[index];
        if (!group) return;
        group.rotation.x += delta * asteroid.spin[0];
        group.rotation.y += delta * asteroid.spin[1];
        group.rotation.z += delta * asteroid.spin[2];
      });
      // Demand renderer: keep spinning while visible.
      invalidate();
    }
  });

  return (
    <group ref={rootRef} visible={false}>
      {/* Horizon only: Earth sits low so just its purple top arc shows below. */}
      {earth && (
        <group ref={earthRef} position={EARTH_POSITION} rotation={EARTH_ROTATION}>
          <primitive object={earth} />
        </group>
      )}
      {asteroids.map((asteroid, index) => (
        <group
          key={asteroid.name}
          ref={(el) => {
            asteroidRefs.current[index] = el;
          }}
          position={asteroid.position}
          rotation={asteroid.rotation}
        >
          <primitive object={asteroid.object} />
        </group>
      ))}
      <points geometry={stars}>
        <pointsMaterial
          ref={starsMaterialRef}
          color="#ddd6fe"
          size={0.045}
          sizeAttenuation
          transparent
          depthWrite={false}
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <pointLight ref={purpleLightRef} position={[-12, 4, 0]} color="#9d6bff" distance={40} intensity={0} />
      {/* The source GLB uses dark, rough PBR stone. A dedicated cool key keeps
          its craters visible over the dark nebula without brightening the copy. */}
      <directionalLight ref={asteroidFillRef} position={[-3, 7, 5]} color="#d9c7ff" intensity={0} />
    </group>
  );
}
