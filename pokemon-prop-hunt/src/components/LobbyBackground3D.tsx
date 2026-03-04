import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

/* ─────────────────────────────────────────────────────────
   Animation sequences — cycle through these for each Pokemon
   ───────────────────────────────────────────────────────── */
interface AnimSequence {
  clip: string;
  duration: number; // how long to play (seconds), 0 = use clip duration
  loop: boolean;
}

const ANIM_SEQUENCES: Record<string, AnimSequence[]> = {
  charizard: [
    { clip: 'loop01', duration: 5, loop: true },
    { clip: 'roar01', duration: 0, loop: false },
    { clip: 'loop01', duration: 4, loop: true },
    { clip: 'Attack1', duration: 0, loop: false },
    { clip: 'waitA01', duration: 4, loop: true },
    { clip: 'Attack2', duration: 0, loop: false },
    { clip: 'loop01', duration: 5, loop: true },
    { clip: 'happyB01', duration: 0, loop: false },
  ],
  bulbasaur: [
    { clip: 'waitA01', duration: 5, loop: true },
    { clip: 'happyA01', duration: 0, loop: false },
    { clip: 'waitA01', duration: 4, loop: true },
    { clip: 'Attack01', duration: 0, loop: false },
    { clip: 'waitA01', duration: 5, loop: true },
    { clip: 'roar01', duration: 0, loop: false },
    { clip: 'waitA01', duration: 3, loop: true },
    { clip: 'happyC01', duration: 0, loop: false },
  ],
  ivysaur: [
    { clip: 'defaultwait01_loop', duration: 4, loop: true },
    { clip: 'attack01', duration: 0, loop: false },
    { clip: 'defaultwait01_loop', duration: 5, loop: true },
    { clip: 'glad01', duration: 0, loop: false },
    { clip: 'run01_loop', duration: 3, loop: true },
    { clip: 'notice01', duration: 0, loop: false },
    { clip: 'defaultwait01_loop', duration: 4, loop: true },
    { clip: 'rangeattack01', duration: 0, loop: false },
  ],
  squirtle: [
    { clip: 'defaultwait01_loop.tranm', duration: 4, loop: true },
    { clip: 'attack01.tranm', duration: 0, loop: false },
    { clip: 'defaultwait01_loop.tranm', duration: 5, loop: true },
    { clip: 'glad01.tranm', duration: 0, loop: false },
    { clip: 'defaultwait01_loop.tranm', duration: 4, loop: true },
    { clip: 'roar01.tranm', duration: 0, loop: false },
    { clip: 'run01_loop.tranm', duration: 3, loop: true },
    { clip: 'rangeattack01.tranm', duration: 0, loop: false },
  ],
  wartortle: [
    { clip: 'waitA01', duration: 5, loop: true },
    { clip: 'Attack1', duration: 0, loop: false },
    { clip: 'waitB01', duration: 4, loop: true },
    { clip: 'happyB01', duration: 0, loop: false },
    { clip: 'waitA01', duration: 5, loop: true },
    { clip: 'Attack2', duration: 0, loop: false },
    { clip: 'walk01', duration: 3, loop: true },
    { clip: 'roar01', duration: 0, loop: false },
  ],
  blastoise: [
    { clip: 'waitA01', duration: 5, loop: true },
    { clip: 'Attack1', duration: 0, loop: false },
    { clip: 'waitB01', duration: 4, loop: true },
    { clip: 'roar01', duration: 0, loop: false },
    { clip: 'waitA01', duration: 4, loop: true },
    { clip: 'Attack3', duration: 0, loop: false },
    { clip: 'waitA01', duration: 5, loop: true },
    { clip: 'happyB01', duration: 0, loop: false },
  ],
};

/* ─────────────────────────────────────────────────────────
   Scene layout: which Pokemon go where
   ───────────────────────────────────────────────────────── */
interface PokemonPlacement {
  model: string;
  position: [number, number, number];
  facingAngle: number; // Y-axis rotation (radians) — faces camera at ~0
  targetHeight: number; // desired height in world units
  bobSpeed: number;
  bobAmount: number;
  bobPhase: number;
  animDelay: number; // seconds before starting animation cycle
}

const POKEMON_PLACEMENTS: PokemonPlacement[] = [
  // Center-back: Charizard — hero, large and dramatic
  {
    model: 'charizard',
    position: [0, 0, -2.5],
    facingAngle: 0,
    targetHeight: 3.5,
    bobSpeed: 1.2,
    bobAmount: 0.12,
    bobPhase: 0,
    animDelay: 0,
  },
  // Left front: Bulbasaur — small, cute
  {
    model: 'bulbasaur',
    position: [-3.8, 0, 2.0],
    facingAngle: 0.35,
    targetHeight: 1.5,
    bobSpeed: 1.5,
    bobAmount: 0.06,
    bobPhase: 1.2,
    animDelay: 2,
  },
  // Left mid: Ivysaur — medium
  {
    model: 'ivysaur',
    position: [-2.5, 0, -0.5],
    facingAngle: 0.25,
    targetHeight: 2.0,
    bobSpeed: 1.3,
    bobAmount: 0.08,
    bobPhase: 2.4,
    animDelay: 1,
  },
  // Right front: Squirtle — small, cute
  {
    model: 'squirtle',
    position: [3.8, 0, 2.0],
    facingAngle: -0.35,
    targetHeight: 1.5,
    bobSpeed: 1.6,
    bobAmount: 0.06,
    bobPhase: 0.8,
    animDelay: 3,
  },
  // Right mid: Wartortle — medium
  {
    model: 'wartortle',
    position: [2.5, 0, -0.5],
    facingAngle: -0.25,
    targetHeight: 2.0,
    bobSpeed: 1.4,
    bobAmount: 0.08,
    bobPhase: 3.6,
    animDelay: 1.5,
  },
  // Far right back: Blastoise — big tank
  {
    model: 'blastoise',
    position: [4.0, 0, -1.5],
    facingAngle: -0.5,
    targetHeight: 3.0,
    bobSpeed: 1.0,
    bobAmount: 0.1,
    bobPhase: 4.8,
    animDelay: 0.5,
  },
];

/* ─────────────────────────────────────────────────────────
   Single animated Pokemon model — CORRECT scale/rotation
   ───────────────────────────────────────────────────────── */
function LobbyPokemon({ placement }: { placement: PokemonPlacement }) {
  const groupRef = useRef<THREE.Group>(null);
  const modelPath = `/models/${placement.model}.glb`;
  const { scene, animations } = useGLTF(modelPath);

  // Clone scene and compute proper normalized scale
  const { clonedScene, normalizedScale, minY } = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        (child as THREE.SkinnedMesh).frustumCulled = false;
      }
    });

    // CRITICAL: Force world matrix computation on cloned scene
    // Without this, Box3 uses stale/identity matrices (wrong bounds)
    cloned.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    bounds.getSize(size);

    const actualHeight = size.y;
    let scale = actualHeight > 0.001
      ? placement.targetHeight / actualHeight
      : 0.1;

    // Sanity clamp
    if (!isFinite(scale) || scale <= 0) scale = 0.1;

    return {
      clonedScene: cloned,
      normalizedScale: scale,
      minY: isFinite(bounds.min.y) ? bounds.min.y : 0,
    };
  }, [scene, placement.targetHeight]);

  // Animation mixer bound directly to clonedScene
  const mixer = useMemo(() => new THREE.AnimationMixer(clonedScene), [clonedScene]);

  // Build clip lookup
  const clipsByName = useMemo(() => {
    const m: Record<string, THREE.AnimationClip> = {};
    for (const c of animations) m[c.name] = c;
    return m;
  }, [animations]);

  // Animation sequencing state
  const [seqIndex, setSeqIndex] = useState(0);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  const sequence = ANIM_SEQUENCES[placement.model] ?? [];

  const playSequenceStep = useCallback((idx: number) => {
    if (sequence.length === 0) return;
    const step = sequence[idx % sequence.length];
    const clip = clipsByName[step.clip];
    if (!clip) {
      // Skip missing clips
      const nextIdx = (idx + 1) % sequence.length;
      setSeqIndex(nextIdx);
      return;
    }

    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(
      step.loop ? THREE.LoopRepeat : THREE.LoopOnce,
      step.loop ? Infinity : 1,
    );
    action.clampWhenFinished = !step.loop;

    // Crossfade from previous
    if (currentActionRef.current && currentActionRef.current !== action) {
      currentActionRef.current.fadeOut(0.4);
    }
    action.fadeIn(0.4).play();
    currentActionRef.current = action;

    // Schedule next step
    const duration = step.duration > 0
      ? step.duration * 1000
      : clip.duration * 1000;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const nextIdx = (idx + 1) % sequence.length;
      setSeqIndex(nextIdx);
    }, duration);
  }, [clipsByName, mixer, sequence]);

  // Start sequence after delay
  useEffect(() => {
    const delayTimer = setTimeout(() => {
      startedRef.current = true;
      playSequenceStep(0);
    }, placement.animDelay * 1000);

    return () => {
      clearTimeout(delayTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to sequence index changes
  useEffect(() => {
    if (startedRef.current && seqIndex > 0) {
      playSequenceStep(seqIndex);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seqIndex]);

  // Frame update: animation mixer + bobbing
  useFrame((_, delta) => {
    mixer.update(delta);
    if (groupRef.current) {
      const t = performance.now() / 1000;
      groupRef.current.position.y =
        placement.position[1] +
        Math.sin(t * placement.bobSpeed + placement.bobPhase) * placement.bobAmount;
    }
  });

  return (
    <group
      ref={groupRef}
      position={placement.position}
      rotation={[0, placement.facingAngle, 0]}
    >
      {/* normalizedScale places the model on ground, NO extra Armature rotation */}
      <group scale={normalizedScale}>
        <primitive object={clonedScene} position={[0, -minY, 0]} />
      </group>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   Circular ground platform
   ───────────────────────────────────────────────────────── */
function GroundPlatform() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <circleGeometry args={[14, 64]} />
      <meshStandardMaterial
        color="#1a1030"
        roughness={0.3}
        metalness={0.6}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

/* ─────────────────────────────────────────────────────────
   Decorative ring on the ground
   ───────────────────────────────────────────────────────── */
function GroundRing() {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ringRef.current) {
      ringRef.current.rotation.z += 0.002;
    }
  });

  return (
    <>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[6.0, 6.4, 64]} />
        <meshBasicMaterial color="#ffd60a" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[8.0, 8.2, 64]} />
        <meshBasicMaterial color="#457b9d" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   Floating particles for atmosphere
   ───────────────────────────────────────────────────────── */
function FloatingParticles() {
  const count = 100;
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = Math.random() * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 24;
      spd[i] = 0.2 + Math.random() * 0.5;
    }
    return { positions: pos, speeds: spd };
  }, []);

  useFrame(() => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * 0.004;
      if (arr[i * 3 + 1] > 12) arr[i * 3 + 1] = 0;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={count}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffd60a"
        size={0.06}
        transparent
        opacity={0.35}
        sizeAttenuation
      />
    </points>
  );
}

/* ─────────────────────────────────────────────────────────
   Scene background + fog
   ───────────────────────────────────────────────────────── */
function SceneSetup() {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color('#080418');
    scene.fog = new THREE.Fog('#080418', 12, 30);
  }, [scene]);

  return null;
}

/* ─────────────────────────────────────────────────────────
   Main exported component
   ───────────────────────────────────────────────────────── */
export default function LobbyBackground3D() {
  return (
    <div className="lobby-3d-background">
      <Canvas
        shadows
        camera={{ position: [0, 3, 12], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <SceneSetup />

        {/* Lighting */}
        <ambientLight intensity={0.6} color="#d0d8ff" />
        <directionalLight
          position={[5, 10, 5]}
          intensity={2.0}
          color="#fff5e6"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />
        {/* Fill light from below-front */}
        <directionalLight position={[-3, 2, 8]} intensity={0.8} color="#b8c4ff" />

        {/* Colored accent lights per Pokemon type */}
        <pointLight position={[0, 3.5, -2]} intensity={30} color="#ff6b2b" distance={12} />
        <pointLight position={[-3.5, 2.5, 1.5]} intensity={18} color="#2a9d8f" distance={10} />
        <pointLight position={[3.5, 2.5, 1.5]} intensity={18} color="#457b9d" distance={10} />
        <pointLight position={[4.5, 2.5, -2.5]} intensity={15} color="#3d5afe" distance={9} />
        <pointLight position={[0, 0.5, 8]} intensity={10} color="#ffd60a" distance={14} />

        {/* Ground */}
        <GroundPlatform />
        <GroundRing />

        {/* Particles */}
        <FloatingParticles />

        {/* Pokemon characters */}
        <Suspense fallback={null}>
          {POKEMON_PLACEMENTS.map((p) => (
            <LobbyPokemon key={p.model} placement={p} />
          ))}
        </Suspense>

        {/* Camera controls */}
        <OrbitControls
          autoRotate
          autoRotateSpeed={0.35}
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          target={[0, 1.5, 0]}
        />
      </Canvas>
    </div>
  );
}

/* Preload models used in the lobby background */
useGLTF.preload('/models/charizard.glb');
useGLTF.preload('/models/bulbasaur.glb');
useGLTF.preload('/models/ivysaur.glb');
useGLTF.preload('/models/squirtle.glb');
useGLTF.preload('/models/wartortle.glb');
useGLTF.preload('/models/blastoise.glb');
