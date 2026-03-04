import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useAnimations } from '@react-three/drei';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

/* ─────────────────────────────────────────────────────────
   Animation sequences — auto-cycle through these for each Pokemon
   Clip names verified directly from GLB binary JSON chunks
   ───────────────────────────────────────────────────────── */
interface AnimSequence {
  clip: string;
  duration: number; // seconds to play (0 = use clip duration)
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
  venusaur: [
    { clip: 'waitA01', duration: 5, loop: true },
    { clip: 'Attack01', duration: 0, loop: false },
    { clip: 'waitB01', duration: 4, loop: true },
    { clip: 'roar01', duration: 0, loop: false },
    { clip: 'waitA01', duration: 4, loop: true },
    { clip: 'Attack3', duration: 0, loop: false },
    { clip: 'waitA01', duration: 5, loop: true },
    { clip: 'happyB01', duration: 0, loop: false },
  ],
  charmander: [
    { clip: 'loop01', duration: 5, loop: true },
    { clip: 'Attack1', duration: 0, loop: false },
    { clip: 'loop01', duration: 4, loop: true },
    { clip: 'happyA01', duration: 0, loop: false },
    { clip: 'waitA01', duration: 4, loop: true },
    { clip: 'roar01', duration: 0, loop: false },
    { clip: 'loop01', duration: 5, loop: true },
    { clip: 'happyC01', duration: 0, loop: false },
  ],
  charmeleon: [
    { clip: 'loop01', duration: 5, loop: true },
    { clip: 'Attack1', duration: 0, loop: false },
    { clip: 'loop01', duration: 4, loop: true },
    { clip: 'happyB01', duration: 0, loop: false },
    { clip: 'waitA01', duration: 4, loop: true },
    { clip: 'Attack2', duration: 0, loop: false },
    { clip: 'loop01', duration: 5, loop: true },
    { clip: 'roar01', duration: 0, loop: false },
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

/* Click-triggered animations per model */
const CLICK_ANIMS: Record<string, string[]> = {
  charizard: ['Attack1', 'Attack2', 'Attack3', 'roar01', 'happyB01'],
  bulbasaur: ['Attack01', 'Atack2', 'happyA01', 'happyC01', 'roar01'],
  ivysaur: ['attack01', 'attack02', 'glad01', 'roar01', 'rangeattack01'],
  venusaur: ['Attack01', 'Attack02', 'Attack3', 'roar01', 'happyB01'],
  charmander: ['Attack1', 'Attack2', 'roar01', 'happyA01', 'happyB01'],
  charmeleon: ['Attack1', 'Attack2', 'roar01', 'happyB01'],
  squirtle: ['attack01.tranm', 'attack02.tranm', 'glad01.tranm', 'roar01.tranm', 'rangeattack01.tranm'],
  wartortle: ['Attack1', 'Attack2', 'happyB01', 'roar01'],
  blastoise: ['Attack1', 'Attack2', 'Attack3', 'roar01', 'happyB01'],
};

/* ─────────────────────────────────────────────────────────
   Scene layout: 9 Pokemon in semi-circular formation
   Back row: final evolutions (large)
   Mid row: mid evolutions (medium)
   Front row: base forms (small)
   ───────────────────────────────────────────────────────── */
interface PokemonPlacement {
  model: string;
  position: [number, number, number];
  facingAngle: number;
  targetHeight: number;
  bobSpeed: number;
  bobAmount: number;
  bobPhase: number;
  animDelay: number;
}

const POKEMON_PLACEMENTS: PokemonPlacement[] = [
  // === Back row: final evolutions ===
  {
    model: 'charizard',
    position: [0, 0, -3.0],
    facingAngle: 0,
    targetHeight: 3.5,
    bobSpeed: 1.2,
    bobAmount: 0.12,
    bobPhase: 0,
    animDelay: 0,
  },
  {
    model: 'venusaur',
    position: [-5.0, 0, -2.0],
    facingAngle: 0.4,
    targetHeight: 2.8,
    bobSpeed: 0.9,
    bobAmount: 0.08,
    bobPhase: 1.0,
    animDelay: 0.5,
  },
  {
    model: 'blastoise',
    position: [5.0, 0, -2.0],
    facingAngle: -0.4,
    targetHeight: 2.8,
    bobSpeed: 1.0,
    bobAmount: 0.1,
    bobPhase: 4.8,
    animDelay: 0.3,
  },
  // === Mid row: mid evolutions ===
  {
    model: 'ivysaur',
    position: [-3.2, 0, 0.0],
    facingAngle: 0.25,
    targetHeight: 2.0,
    bobSpeed: 1.3,
    bobAmount: 0.08,
    bobPhase: 2.4,
    animDelay: 1,
  },
  {
    model: 'charmeleon',
    position: [0.8, 0, 0.8],
    facingAngle: -0.1,
    targetHeight: 2.0,
    bobSpeed: 1.35,
    bobAmount: 0.07,
    bobPhase: 3.2,
    animDelay: 1.5,
  },
  {
    model: 'wartortle',
    position: [3.2, 0, 0.0],
    facingAngle: -0.25,
    targetHeight: 2.0,
    bobSpeed: 1.4,
    bobAmount: 0.08,
    bobPhase: 3.6,
    animDelay: 1.2,
  },
  // === Front row: base forms ===
  {
    model: 'bulbasaur',
    position: [-4.5, 0, 2.5],
    facingAngle: 0.35,
    targetHeight: 1.4,
    bobSpeed: 1.5,
    bobAmount: 0.06,
    bobPhase: 1.2,
    animDelay: 2,
  },
  {
    model: 'charmander',
    position: [-1.2, 0, 3.0],
    facingAngle: 0.15,
    targetHeight: 1.3,
    bobSpeed: 1.6,
    bobAmount: 0.05,
    bobPhase: 0.5,
    animDelay: 2.5,
  },
  {
    model: 'squirtle',
    position: [4.5, 0, 2.5],
    facingAngle: -0.35,
    targetHeight: 1.4,
    bobSpeed: 1.6,
    bobAmount: 0.06,
    bobPhase: 0.8,
    animDelay: 2.2,
  },
];

/* ─────────────────────────────────────────────────────────
   Single animated Pokemon — uses drei useAnimations for
   reliable skeleton binding across all model types
   ───────────────────────────────────────────────────────── */
function LobbyPokemon({ placement }: { placement: PokemonPlacement }) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const modelPath = `/models/${placement.model}.glb`;
  const { scene, animations } = useGLTF(modelPath);

  // Clone scene and compute proper normalized scale
  const { clonedScene, normalizedScale, minY } = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Enhance materials to match CGTrader reference quality
        const mesh = child as THREE.Mesh;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (mat && 'roughness' in mat) {
            const std = mat as THREE.MeshStandardMaterial;
            std.roughness = Math.min(std.roughness, 0.4);
            std.metalness = Math.max(std.metalness, 0.0);
            // Make fire materials glow
            if (std.name && std.name.match(/^Fire/i)) {
              const c = std.color || new THREE.Color(1, 0.4, 0.1);
              std.emissive = c.clone();
              std.emissiveIntensity = 2.0;
            }
          }
        }
      }
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        (child as THREE.SkinnedMesh).frustumCulled = false;
      }
    });

    cloned.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    bounds.getSize(size);

    const actualHeight = size.y;
    let scale = actualHeight > 0.001
      ? placement.targetHeight / actualHeight
      : 0.1;
    if (!isFinite(scale) || scale <= 0) scale = 0.1;

    return {
      clonedScene: cloned,
      normalizedScale: scale,
      minY: isFinite(bounds.min.y) ? bounds.min.y : 0,
    };
  }, [scene, placement.targetHeight]);


  // drei's useAnimations: creates mixer + actions with correct root binding
  // This handles bone resolution reliably across all skeleton structures
  const { actions } = useAnimations(animations, innerRef);

  // Animation sequencing state
  const [seqIndex, setSeqIndex] = useState(0);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);
  const clickLockedRef = useRef(false); // true while click animation plays

  const sequence = ANIM_SEQUENCES[placement.model] ?? [];
  const clickAnims = CLICK_ANIMS[placement.model] ?? [];

  // Hover state for cursor
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
    return () => { document.body.style.cursor = 'auto'; };
  }, [hovered]);

  // Play a specific animation action with crossfade
  const playAction = useCallback((clipName: string, loop: boolean, onFinish?: () => void) => {
    const action = actions[clipName];
    if (!action) return false;

    action.reset();
    action.setLoop(
      loop ? THREE.LoopRepeat : THREE.LoopOnce,
      loop ? Infinity : 1,
    );
    action.clampWhenFinished = !loop;

    if (currentActionRef.current && currentActionRef.current !== action) {
      currentActionRef.current.fadeOut(0.4);
    }
    action.fadeIn(0.4).play();
    currentActionRef.current = action;

    if (onFinish) {
      const duration = action.getClip().duration * 1000;
      setTimeout(onFinish, duration);
    }
    return true;
  }, [actions]);

  // Play one step from the auto-cycle sequence
  const playSequenceStep = useCallback((idx: number) => {
    if (sequence.length === 0 || clickLockedRef.current) return;

    const step = sequence[idx % sequence.length];
    const played = playAction(step.clip, step.loop);

    if (!played) {
      // Clip not found — skip to next
      const nextIdx = (idx + 1) % sequence.length;
      setSeqIndex(nextIdx);
      return;
    }

    // Schedule next step
    const action = actions[step.clip];
    const duration = step.duration > 0
      ? step.duration * 1000
      : (action ? action.getClip().duration * 1000 : 3000);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!clickLockedRef.current) {
        const nextIdx = (idx + 1) % sequence.length;
        setSeqIndex(nextIdx);
      }
    }, duration);
  }, [actions, playAction, sequence]);

  // Start auto-cycle after initial delay
  useEffect(() => {
    const delayTimer = setTimeout(() => {
      startedRef.current = true;
      playSequenceStep(0);
    }, placement.animDelay * 1000);

    return () => {
      clearTimeout(delayTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
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

  // Click handler: play random special animation, then resume cycling
  const handleClick = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (clickLockedRef.current || clickAnims.length === 0) return;

    // Lock cycling
    clickLockedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);

    // Pick a random click animation
    const clipName = clickAnims[Math.floor(Math.random() * clickAnims.length)];
    const played = playAction(clipName, false, () => {
      // Resume cycling after click animation finishes
      clickLockedRef.current = false;
      if (startedRef.current) {
        const nextIdx = (seqIndex + 1) % sequence.length;
        setSeqIndex(nextIdx);
      }
    });

    if (!played) {
      clickLockedRef.current = false;
    }
  }, [clickAnims, playAction, seqIndex, sequence.length]);

  // Frame update: bobbing only (mixer.update handled by useAnimations)
  useFrame(() => {
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
      <group ref={innerRef} scale={normalizedScale}>
        <primitive object={clonedScene} position={[0, -minY, 0]} />
      </group>
      {/* Invisible click target — cylinder covering Pokemon volume */}
      <mesh
        position={[0, placement.targetHeight / 2, 0]}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <cylinderGeometry args={[
          placement.targetHeight * 0.4,
          placement.targetHeight * 0.4,
          placement.targetHeight,
          8,
        ]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────
   Circular ground platform
   ───────────────────────────────────────────────────────── */
function GroundPlatform() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <circleGeometry args={[16, 64]} />
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
        <ringGeometry args={[7.0, 7.4, 64]} />
        <meshBasicMaterial color="#ffd60a" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[9.5, 9.7, 64]} />
        <meshBasicMaterial color="#457b9d" transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   Floating particles for atmosphere
   ───────────────────────────────────────────────────────── */
function FloatingParticles() {
  const count = 120;
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 28;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 28;
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
      if (arr[i * 3 + 1] > 14) arr[i * 3 + 1] = 0;
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
    scene.fog = new THREE.Fog('#080418', 14, 35);
  }, [scene]);

  return null;
}

/* ─────────────────────────────────────────────────────────
   Main exported component
   ───────────────────────────────────────────────────────── */
export default function LobbyBackground3D() {
  return (
    <div className="lobby-3d-background" style={{ filter: 'saturate(1.6) contrast(1.08) brightness(1.05)' }}>
      <Canvas
        shadows
        camera={{ position: [0, 3.5, 14], fov: 50 }}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5,
        }}
      >
        <SceneSetup />

        {/* Lighting — balanced neutral for accurate texture colors */}
        <hemisphereLight
          args={['#ffffff', '#ffeedd', 0.8]}
          position={[0, 10, 0]}
        />
        <directionalLight
          position={[5, 10, 5]}
          intensity={3.0}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
        />
        {/* Fill light from front-left — subtle warm */}
        <directionalLight position={[-3, 3, 8]} intensity={1.2} color="#ffffff" />
        {/* Rim/back light */}
        <directionalLight position={[3, 4, -6]} intensity={0.6} color="#ddeeff" />

        {/* Subtle colored accent lights — atmospheric only, low enough to not override textures */}
        <pointLight position={[0, 4, -2]} intensity={6} color="#ff6b2b" distance={10} />
        <pointLight position={[-5, 2.5, 1.5]} intensity={3} color="#60c0b0" distance={10} />
        <pointLight position={[5, 2.5, 1.5]} intensity={3} color="#6090d0" distance={10} />
        <pointLight position={[0, 0.5, 8]} intensity={3} color="#ffd60a" distance={14} />

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

/* Preload all 9 Pokemon models */
useGLTF.preload('/models/charizard.glb');
useGLTF.preload('/models/bulbasaur.glb');
useGLTF.preload('/models/ivysaur.glb');
useGLTF.preload('/models/venusaur.glb');
useGLTF.preload('/models/charmander.glb');
useGLTF.preload('/models/charmeleon.glb');
useGLTF.preload('/models/squirtle.glb');
useGLTF.preload('/models/wartortle.glb');
useGLTF.preload('/models/blastoise.glb');
