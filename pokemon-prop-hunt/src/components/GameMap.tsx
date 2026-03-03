import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { useGLTF } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const MAP_HALF_SIZE = 50;
const CLEARING_RADIUS = 10;

type ScatterPoint = {
  x: number;
  z: number;
  scale: number;
  rotation: number;
  tiltX: number;
  tiltZ: number;
  variant: number;
};

type ScatterOptions = {
  seed: string;
  count: number;
  minRadiusFromCenter: number;
  edgePadding: number;
  minSpacing: number;
  minScale: number;
  maxScale: number;
  variantCount: number;
};

type LogPoint = {
  x: number;
  z: number;
  length: number;
  radius: number;
  rotationY: number;
  tiltZ: number;
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function generateScatterPoints(options: ScatterOptions) {
  const rng = createRng(options.seed);
  const points: ScatterPoint[] = [];
  const maxAttempts = options.count * 140;
  let attempts = 0;

  while (points.length < options.count && attempts < maxAttempts) {
    attempts += 1;
    const span = MAP_HALF_SIZE - options.edgePadding;
    const x = (rng() * 2 - 1) * span;
    const z = (rng() * 2 - 1) * span;

    if (Math.hypot(x, z) <= options.minRadiusFromCenter) {
      continue;
    }

    let overlaps = false;
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex];
      const dx = point.x - x;
      const dz = point.z - z;
      if (dx * dx + dz * dz < options.minSpacing * options.minSpacing) {
        overlaps = true;
        break;
      }
    }

    if (overlaps) {
      continue;
    }

    points.push({
      x,
      z,
      scale: options.minScale + rng() * (options.maxScale - options.minScale),
      rotation: rng() * Math.PI * 2,
      tiltX: (rng() * 2 - 1) * 0.05,
      tiltZ: (rng() * 2 - 1) * 0.05,
      variant: Math.floor(rng() * options.variantCount),
    });
  }

  return points;
}

function generateBoundaryTrees() {
  const rng = createRng('boundary-tree-line');
  const points: ScatterPoint[] = [];
  const sideConfig = [
    { axis: 'x', fixed: -46, count: 4 },
    { axis: 'x', fixed: 46, count: 4 },
    { axis: 'z', fixed: -46, count: 3 },
    { axis: 'z', fixed: 46, count: 3 },
  ] as const;

  sideConfig.forEach((side) => {
    for (let index = 0; index < side.count; index += 1) {
      const t = (index + 1) / (side.count + 1);
      const sweep = -35 + t * 70 + (rng() * 2 - 1) * 2.8;
      const x = side.axis === 'x' ? side.fixed + (rng() * 2 - 1) * 1.6 : sweep;
      const z = side.axis === 'z' ? side.fixed + (rng() * 2 - 1) * 1.6 : sweep;

      points.push({
        x,
        z,
        scale: 1 + rng() * 0.45,
        rotation: rng() * Math.PI * 2,
        tiltX: (rng() * 2 - 1) * 0.04,
        tiltZ: (rng() * 2 - 1) * 0.04,
        variant: Math.floor(rng() * 4),
      });
    }
  });

  return points;
}

function generateLogs() {
  const rng = createRng('fallen-logs');
  const logs: LogPoint[] = [];
  let attempts = 0;

  while (logs.length < 6 && attempts < 200) {
    attempts += 1;
    const x = (rng() * 2 - 1) * 40;
    const z = (rng() * 2 - 1) * 40;
    if (Math.hypot(x, z) <= CLEARING_RADIUS + 4) {
      continue;
    }

    logs.push({
      x,
      z,
      length: 2.8 + rng() * 1.8,
      radius: 0.24 + rng() * 0.12,
      rotationY: rng() * Math.PI * 2,
      tiltZ: (rng() * 2 - 1) * 0.18,
    });
  }

  return logs;
}

function GrassPatchField({ points }: { points: ScatterPoint[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { geometry, material, matrices, colors } = useMemo(() => {
    const geometryMemo = new THREE.ConeGeometry(0.45, 1.1, 5);
    const materialMemo = new THREE.MeshStandardMaterial({
      roughness: 0.96,
      metalness: 0,
      vertexColors: true,
    });
    const matrixArray: THREE.Matrix4[] = [];
    const colorArray: THREE.Color[] = [];

    const colorPalette = ['#5DAE44', '#4D9B3D', '#6AB94E'];
    const dummy = new THREE.Object3D();

    points.forEach((point) => {
      dummy.position.set(point.x, 0.35, point.z);
      dummy.rotation.set(0, point.rotation, 0);
      dummy.scale.set(point.scale * 0.45, point.scale * 0.7, point.scale * 0.45);
      dummy.updateMatrix();
      matrixArray.push(dummy.matrix.clone());
      colorArray.push(new THREE.Color(colorPalette[point.variant % colorPalette.length]));
    });

    return {
      geometry: geometryMemo,
      material: materialMemo,
      matrices: matrixArray,
      colors: colorArray,
    };
  }, [points]);

  useLayoutEffect(() => {
    if (!meshRef.current) {
      return;
    }

    matrices.forEach((matrix, index) => {
      meshRef.current?.setMatrixAt(index, matrix);
      meshRef.current?.setColorAt(index, colors[index]);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [colors, matrices]);

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, points.length]} castShadow receiveShadow />
  );
}

const TREE_MODEL_PATHS = [
  '/models/nature/BirchTree_1.glb',
  '/models/nature/BirchTree_2.glb',
  '/models/nature/BirchTree_3.glb',
] as const;

const BUSH_MODEL_PATHS = [
  '/models/nature/Bush.glb',
  '/models/nature/Bush_Large.glb',
  '/models/nature/Bush_Small.glb',
] as const;

type QuaterniusNatureProps = {
  point: ScatterPoint;
};

function QuaterniusTree({ point }: QuaterniusNatureProps) {
  const treeScale = point.scale * 2.5;
  const modelPath = TREE_MODEL_PATHS[point.variant % TREE_MODEL_PATHS.length];
  const gltf = useGLTF(modelPath);

  const clonedScene = useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return scene;
  }, [gltf.scene]);

  return (
    <RigidBody type="fixed" colliders={false} position={[point.x, 0, point.z]} rotation={[point.tiltX, point.rotation, point.tiltZ]}>
      <CuboidCollider args={[0.38 * treeScale, 1.1 * treeScale, 0.38 * treeScale]} position={[0, 1.1 * treeScale, 0]} />
      <primitive object={clonedScene} scale={[treeScale, treeScale, treeScale]} />
    </RigidBody>
  );
}

function QuaterniusBush({ point }: QuaterniusNatureProps) {
  const bushScale = point.scale * 1.8;
  const modelPath = BUSH_MODEL_PATHS[point.variant % BUSH_MODEL_PATHS.length];
  const gltf = useGLTF(modelPath);

  const clonedScene = useMemo(() => {
    const scene = gltf.scene.clone(true);
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return scene;
  }, [gltf.scene]);

  return (
    <RigidBody type="fixed" colliders={false} position={[point.x, 0, point.z]} rotation={[point.tiltX, point.rotation, point.tiltZ]}>
      <CuboidCollider args={[0.42 * bushScale, 0.45 * bushScale, 0.42 * bushScale]} position={[0, 0.45 * bushScale, 0]} />
      <primitive object={clonedScene} scale={[bushScale, bushScale, bushScale]} />
    </RigidBody>
  );
}

export default function GameMap() {
  const treePoints = useMemo(
    () => [
      ...generateScatterPoints({
        seed: 'core-trees',
        count: 42,
        minRadiusFromCenter: CLEARING_RADIUS,
        edgePadding: 6,
        minSpacing: 5,
        minScale: 0.8,
        maxScale: 1.5,
        variantCount: 4,
      }),
      ...generateBoundaryTrees(),
    ],
    [],
  );

  const rockPoints = useMemo(
    () =>
      generateScatterPoints({
        seed: 'rock-field',
        count: 18,
        minRadiusFromCenter: CLEARING_RADIUS,
        edgePadding: 8,
        minSpacing: 6,
        minScale: 0.8,
        maxScale: 1.35,
        variantCount: 4,
      }),
    [],
  );

  const bushPoints = useMemo(
    () =>
      generateScatterPoints({
        seed: 'bush-clumps',
        count: 10,
        minRadiusFromCenter: CLEARING_RADIUS,
        edgePadding: 10,
        minSpacing: 8,
        minScale: 0.85,
        maxScale: 1.3,
        variantCount: 3,
      }),
    [],
  );

  const grassPoints = useMemo(
    () =>
      generateScatterPoints({
        seed: 'grass-patches',
        count: 90,
        minRadiusFromCenter: CLEARING_RADIUS,
        edgePadding: 7,
        minSpacing: 2.7,
        minScale: 0.85,
        maxScale: 1.35,
        variantCount: 3,
      }),
    [],
  );

  const logPoints = useMemo(() => generateLogs(), []);

  const geometry = useMemo(
    () => ({
      rock: new THREE.DodecahedronGeometry(1.1, 0),
      log: new THREE.CylinderGeometry(0.35, 0.35, 1, 8),
    }),
    [],
  );

  const materials = useMemo(
    () => ({
      ground: new THREE.MeshStandardMaterial({ color: '#78C850', roughness: 0.96, metalness: 0 }),
      rock: [
        new THREE.MeshStandardMaterial({ color: '#8F8A80', roughness: 0.9, metalness: 0.04 }),
        new THREE.MeshStandardMaterial({ color: '#9D968A', roughness: 0.9, metalness: 0.04 }),
        new THREE.MeshStandardMaterial({ color: '#7E7B72', roughness: 0.9, metalness: 0.04 }),
        new THREE.MeshStandardMaterial({ color: '#8B8171', roughness: 0.9, metalness: 0.04 }),
      ],
      log: new THREE.MeshStandardMaterial({ color: '#8D5A35', roughness: 0.94, metalness: 0.02 }),
      boundary: new THREE.MeshStandardMaterial({ color: '#5D8D43', roughness: 1, metalness: 0 }),
      sky: new THREE.MeshBasicMaterial({ color: '#BEECD9', side: THREE.BackSide, fog: false }),
    }),
    [],
  );

  return (
    <group>
      <hemisphereLight args={['#FFE4B8', '#7FA566', 0.82]} />
      <directionalLight
        castShadow
        intensity={1.12}
        color="#FFD6A0"
        position={[34, 44, 20]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00015}
        shadow-camera-near={1}
        shadow-camera-far={190}
        shadow-camera-left={-78}
        shadow-camera-right={78}
        shadow-camera-top={78}
        shadow-camera-bottom={-78}
      />

      <mesh material={materials.sky} position={[0, 24, 0]} scale={[1, 0.68, 1]}>
        <sphereGeometry args={[220, 32, 24]} />
      </mesh>

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[MAP_HALF_SIZE, 0.3, MAP_HALF_SIZE]} position={[0, -0.3, 0]} />
        <mesh material={materials.ground} position={[0, -0.3, 0]} receiveShadow>
          <boxGeometry args={[100, 0.6, 100]} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[MAP_HALF_SIZE, 3, 0.9]} position={[0, 3, -50]} />
        <CuboidCollider args={[MAP_HALF_SIZE, 3, 0.9]} position={[0, 3, 50]} />
        <CuboidCollider args={[0.9, 3, MAP_HALF_SIZE]} position={[-50, 3, 0]} />
        <CuboidCollider args={[0.9, 3, MAP_HALF_SIZE]} position={[50, 3, 0]} />

        <mesh position={[0, 0.35, -49.6]} castShadow receiveShadow material={materials.boundary}>
          <boxGeometry args={[100, 0.7, 1.2]} />
        </mesh>
        <mesh position={[0, 0.35, 49.6]} castShadow receiveShadow material={materials.boundary}>
          <boxGeometry args={[100, 0.7, 1.2]} />
        </mesh>
        <mesh position={[-49.6, 0.35, 0]} castShadow receiveShadow material={materials.boundary}>
          <boxGeometry args={[1.2, 0.7, 100]} />
        </mesh>
        <mesh position={[49.6, 0.35, 0]} castShadow receiveShadow material={materials.boundary}>
          <boxGeometry args={[1.2, 0.7, 100]} />
        </mesh>
      </RigidBody>

      <mesh position={[0, 0.02, 0]} receiveShadow>
        <ringGeometry args={[6.2, 8.1, 40]} />
        <meshStandardMaterial color="#8FD36A" roughness={0.95} metalness={0} />
      </mesh>

      {treePoints.map((point, index) => (
        <QuaterniusTree key={`tree-${index}`} point={point} />
      ))}

      {rockPoints.map((point, index) => {
        const rockScale = point.scale;
        return (
          <RigidBody
            key={`rock-${index}`}
            type="fixed"
            colliders={false}
            position={[point.x, rockScale * 0.58, point.z]}
            rotation={[point.tiltX * 3, point.rotation, point.tiltZ * 3]}
          >
            <CuboidCollider args={[0.95 * rockScale, 0.6 * rockScale, 0.95 * rockScale]} />
            <mesh
              geometry={geometry.rock}
              material={materials.rock[point.variant]}
              castShadow
              receiveShadow
              scale={[rockScale, rockScale * 0.8, rockScale]}
            />
          </RigidBody>
        );
      })}

      {bushPoints.map((point, index) => (
        <QuaterniusBush key={`bush-${index}`} point={point} />
      ))}

      {logPoints.map((log, index) => (
        <RigidBody key={`log-${index}`} type="fixed" colliders={false} position={[log.x, log.radius + 0.04, log.z]} rotation={[0, log.rotationY, log.tiltZ]}>
          <CuboidCollider args={[log.length * 0.5, log.radius, log.radius]} />
          <mesh
            geometry={geometry.log}
            material={materials.log}
            castShadow
            receiveShadow
            rotation={[0, 0, Math.PI * 0.5]}
            scale={[1, log.length, 1]}
          />
        </RigidBody>
      ))}

      <GrassPatchField points={grassPoints} />
    </group>
  );
}

useGLTF.preload('/models/nature/BirchTree_1.glb');
useGLTF.preload('/models/nature/BirchTree_2.glb');
useGLTF.preload('/models/nature/BirchTree_3.glb');
useGLTF.preload('/models/nature/Bush.glb');
useGLTF.preload('/models/nature/Bush_Large.glb');
useGLTF.preload('/models/nature/Bush_Small.glb');
