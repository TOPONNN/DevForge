import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

/* ─────────────────────────────────────────────────────────
   Idle animation clip names (verified from GLB data)
   ───────────────────────────────────────────────────────── */
const IDLE_CLIPS: Record<string, string> = {
  bulbasaur: 'waitA01',
  ivysaur: 'defaultwait01_loop',
  venusaur: 'waitA01',
  charmander: 'loop01',
  charmeleon: 'loop01',
  charizard: 'loop01',
  squirtle: 'defaultwait01_loop.tranm',
  wartortle: 'waitA01',
  blastoise: 'waitA01',
};

/* ─────────────────────────────────────────────────────────
   Scene layout: which Pokemon go where
   ───────────────────────────────────────────────────────── */
interface PokemonPlacement {
  model: string;
  position: [number, number, number];
  rotation: number; // Y-axis rotation in radians
  scale: number;
  bobSpeed: number;
  bobAmount: number;
  bobPhase: number;
}

const POKEMON_PLACEMENTS: PokemonPlacement[] = [
  // Center-back: Charizard — hero, large and dramatic
  {
    model: 'charizard',
    position: [0, 0.6, -2],
    rotation: 0,
    scale: 0.0055,
    bobSpeed: 1.2,
    bobAmount: 0.15,
    bobPhase: 0,
  },
  // Left front: Bulbasaur
  {
    model: 'bulbasaur',
    position: [-3.5, 0, 1.5],
    rotation: 0.4,
    scale: 0.004,
    bobSpeed: 1.5,
    bobAmount: 0.08,
    bobPhase: 1.2,
  },
  // Left mid: Ivysaur
  {
    model: 'ivysaur',
    position: [-2.0, 0, -0.5],
    rotation: 0.3,
    scale: 0.048,
    bobSpeed: 1.3,
    bobAmount: 0.1,
    bobPhase: 2.4,
  },
  // Right front: Squirtle
  {
    model: 'squirtle',
    position: [3.5, 0, 1.5],
    rotation: -0.4,
    scale: 0.012,
    bobSpeed: 1.6,
    bobAmount: 0.08,
    bobPhase: 0.8,
  },
  // Right mid: Wartortle
  {
    model: 'wartortle',
    position: [2.0, 0, -0.5],
    rotation: -0.3,
    scale: 0.0045,
    bobSpeed: 1.4,
    bobAmount: 0.1,
    bobPhase: 3.6,
  },
  // Far right back: Blastoise
  {
    model: 'blastoise',
    position: [4.2, 0, -2.5],
    rotation: -0.5,
    scale: 0.006,
    bobSpeed: 1.0,
    bobAmount: 0.12,
    bobPhase: 4.8,
  },
];

/* ─────────────────────────────────────────────────────────
   Single animated Pokemon model
   ───────────────────────────────────────────────────────── */
function LobbyPokemon({ placement }: { placement: PokemonPlacement }) {
  const groupRef = useRef<THREE.Group>(null);
  const modelPath = `/models/${placement.model}.glb`;
  const { scene, animations } = useGLTF(modelPath);

  const clonedScene = useMemo(() => {
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
    return cloned;
  }, [scene]);

  // Animation
  const mixer = useMemo(() => new THREE.AnimationMixer(clonedScene), [clonedScene]);

  useEffect(() => {
    const idleClipName = IDLE_CLIPS[placement.model];
    if (!idleClipName) return;
    const clip = animations.find((c) => c.name === idleClipName);
    if (!clip) return;

    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
    };
  }, [animations, clonedScene, mixer, placement.model]);

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
      rotation={[0, placement.rotation, 0]}
      scale={placement.scale}
    >
      <group rotation={[Math.PI / 2, 0, 0]} scale={10}>
        <primitive object={clonedScene} />
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
      <circleGeometry args={[12, 64]} />
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
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <ringGeometry args={[5.5, 6.0, 64]} />
      <meshBasicMaterial color="#ffd60a" transparent opacity={0.12} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ─────────────────────────────────────────────────────────
   Floating particles for atmosphere
   ───────────────────────────────────────────────────────── */
function FloatingParticles() {
  const count = 80;
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = Math.random() * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
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
      arr[i * 3 + 1] += speeds[i] * 0.005;
      if (arr[i * 3 + 1] > 10) arr[i * 3 + 1] = 0;
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
        size={0.05}
        transparent
        opacity={0.4}
        sizeAttenuation
      />
    </points>
  );
}

/* ─────────────────────────────────────────────────────────
   Scene background gradient via shader
   ───────────────────────────────────────────────────────── */
function SceneSetup() {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color('#080418');
    scene.fog = new THREE.Fog('#080418', 10, 28);
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
        camera={{ position: [0, 3.5, 11], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <SceneSetup />

        {/* Lighting */}
        <ambientLight intensity={0.35} color="#b8c4ff" />
        <directionalLight
          position={[5, 8, 4]}
          intensity={1.2}
          color="#fff5e6"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />

        {/* Colored accent lights */}
        {/* Charizard — warm fire glow */}
        <pointLight position={[0, 2, -1.5]} intensity={15} color="#ff6b2b" distance={8} />
        {/* Bulbasaur/Ivysaur — green glow */}
        <pointLight position={[-3, 1.5, 0.5]} intensity={10} color="#2a9d8f" distance={7} />
        {/* Squirtle/Wartortle — blue glow */}
        <pointLight position={[3, 1.5, 0.5]} intensity={10} color="#457b9d" distance={7} />
        {/* Blastoise — deep blue */}
        <pointLight position={[4.5, 1.5, -2]} intensity={8} color="#3d5afe" distance={6} />
        {/* Floor rim light */}
        <pointLight position={[0, 0.3, 5]} intensity={5} color="#ffd60a" distance={10} />

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
          autoRotateSpeed={0.4}
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
