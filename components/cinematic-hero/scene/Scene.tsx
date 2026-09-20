import { Suspense, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import BackdropText from './BackdropText';
import CameraRig from './CameraRig';
import RiggedLaptop from './RiggedLaptop';
import CosmicModels from './CosmicModels';
import type { VoiceScreenContent } from './VoiceScreen';
import { filmDriver } from '../filmDriver';
import { TIMELINE } from '../timeline';

/**
 * Local studio reflections for the laptop's near-black PBR body.
 *
 * The GLB body is black dielectric plastic plus dark metals. Directional
 * lights alone leave those surfaces crushed: metals need an environment to
 * reflect, and near-black diffuse barely responds to punctual lights. A
 * locally generated RoomEnvironment (no network fetch, built once) gives the
 * bevels, hinge and trim controlled specular form at low intensity, while the
 * background, floor and screen — all unlit materials — stay exactly as dark
 * and crisp as before. No render loop: the texture is built once and the
 * demand renderer is invalidated a single time.
 */
function StudioEnvironment({ intensity = 0.5 }: { intensity?: number }): null {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const envTexture = pmrem.fromScene(room, 0.04).texture;
    const previousEnv = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = envTexture;
    scene.environmentIntensity = intensity;
    invalidate();
    return () => {
      scene.environment = previousEnv ?? null;
      scene.environmentIntensity = previousIntensity;
      room.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          const material = mesh.material as THREE.Material | THREE.Material[];
          (Array.isArray(material) ? material : [material]).forEach((m) => m.dispose());
        }
      });
      envTexture.dispose();
      pmrem.dispose();
    };
  }, [scene, gl, invalidate, intensity]);

  return null;
}

/** The laptop act exits after the DOM panel owns the frame; the canvas stays
 * mounted so its space act can take over without a white flash or a second
 * WebGL context. */
function LaptopAct({ screenContent }: { screenContent?: VoiceScreenContent }): JSX.Element {
  const ref = useRef<THREE.Group | null>(null);

  useFrame(() => {
    if (ref.current) ref.current.visible = filmDriver.currentT < TIMELINE.handoffEndT + 0.015;
  });

  return (
    <group ref={ref}>
      <BackdropText />
      <RiggedLaptop content={screenContent} />
      {/* Studio floor: grounds the laptop product shot ONLY. It rides with
          the laptop act so that once the film hands off, the set floor exits
          with it and can never occlude the space act (Earth horizon sits
          below floor level by design). */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.135, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial color="#0a0a0e" />
      </mesh>
    </group>
  );
}

/**
 * Cinematic scene shell: studio/product lighting for the real laptop, the
 * film-driven camera rig, and the rigged laptop. No decorative loops, no
 * shadows, no post-processing — background stays dark.
 */
export default function Scene({ screenContent }: { screenContent?: VoiceScreenContent }): JSX.Element {
  return (
    <>
      <color attach="background" args={['#050505']} />
      {/* Environmental depth: floor edges dissolve into the background (negligible at film distances). */}
      <fogExp2 attach="fog" args={['#050505', 0.022]} />
      {/* Image-based form for the black PBR body (see StudioEnvironment). */}
      <StudioEnvironment intensity={0.5} />
      {/* Ambient base kept low so the environment carries form without flattening. */}
      <hemisphereLight args={['#9aa3b5', '#0a0a0c', 0.45]} />
      {/* Key: warm-white, front-top-right — reads the top deck, keys, lid face. */}
      <directionalLight position={[5, 7, 4]} intensity={2.4} color="#fff4e8" />
      {/* Fill: cool, front-left, low — lifts shadow-side detail without flattening. */}
      <directionalLight position={[-6, 2.5, 4]} intensity={0.6} color="#b9c6ff" />
      {/* Rim: cool back-left, raised — separates the black lid silhouette from
          the black background and grazes the lid edges, hinge and bevels. */}
      <directionalLight position={[-4, 4, -5]} intensity={2.2} color="#cfe0ff" />
      <CameraRig />
      <LaptopAct screenContent={screenContent} />
      {/* Loads independently, so the real laptop can start before the two GLBs
          have arrived. */}
      <Suspense fallback={null}>
        <CosmicModels />
      </Suspense>
    </>
  );
}
