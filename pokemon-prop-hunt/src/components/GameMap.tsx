import { Cloud, Sky, Sparkles, useGLTF } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
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

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function terrainHeightAt(x: number, z: number) {
  const layeredHeight =
    Math.sin(x * 0.08) * 1.2 +
    Math.sin(z * 0.12) * 0.8 +
    Math.sin(x * 0.05 + z * 0.07) * 1.5;
  const clearingBlend = smoothstep(CLEARING_RADIUS - 1.5, CLEARING_RADIUS + 9, Math.hypot(x, z));
  return layeredHeight * clearingBlend * 0.35;
}

function GrassPatchField({ points }: { points: ScatterPoint[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { geometry, material, matrices, colors } = useMemo(() => {
    const geometryMemo = new THREE.PlaneGeometry(0.15, 0.8, 1, 4);
    const position = geometryMemo.attributes.position as THREE.BufferAttribute;
    for (let index = 0; index < position.count; index += 1) {
      const y = position.getY(index);
      const bend = Math.max(0, y + 0.4);
      position.setX(index, position.getX(index) + bend * bend * 0.08);
      position.setZ(index, bend * 0.05);
    }
    position.needsUpdate = true;
    geometryMemo.computeVertexNormals();

    const materialMemo = new THREE.MeshStandardMaterial({
      roughness: 0.95,
      metalness: 0,
      vertexColors: true,
      side: THREE.DoubleSide,
    });
    const matrixArray: THREE.Matrix4[] = [];
    const colorArray: THREE.Color[] = [];

    const colorPalette = ['#4E8F36', '#5DAE44', '#6AB94E', '#84BE52', '#3E7B2F'];
    const dummy = new THREE.Object3D();
    const rng = createRng('grass-blades');

    points.forEach((point) => {
      const bladeHeight = 0.65 + rng() * 0.55;
      const terrainY = terrainHeightAt(point.x, point.z);
      dummy.position.set(point.x, terrainY + bladeHeight * 0.33, point.z);
      dummy.rotation.set((rng() * 2 - 1) * 0.12, point.rotation, (rng() * 2 - 1) * 0.12);
      dummy.scale.set(point.scale * 0.9, bladeHeight * point.scale, point.scale * 0.9);
      dummy.updateMatrix();
      matrixArray.push(dummy.matrix.clone());
      colorArray.push(new THREE.Color(colorPalette[Math.floor(rng() * colorPalette.length)]));
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

  return <instancedMesh ref={meshRef} args={[geometry, material, points.length]} castShadow receiveShadow />;
}

function FlowerField({ points }: { points: ScatterPoint[] }) {
  const stemRef = useRef<THREE.InstancedMesh>(null);
  const bloomRef = useRef<THREE.InstancedMesh>(null);

  const { stemGeometry, stemMaterial, bloomGeometry, bloomMaterial, stemMatrices, bloomMatrices, bloomColors } = useMemo(() => {
    const stemGeometryMemo = new THREE.CylinderGeometry(0.018, 0.025, 0.5, 6);
    const bloomGeometryMemo = new THREE.SphereGeometry(0.1, 8, 8);
    const stemMaterialMemo = new THREE.MeshStandardMaterial({ color: '#5E9440', roughness: 0.95, metalness: 0 });
    const bloomMaterialMemo = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.02 });

    const stemMatrixArray: THREE.Matrix4[] = [];
    const bloomMatrixArray: THREE.Matrix4[] = [];
    const bloomColorArray: THREE.Color[] = [];
    const dummy = new THREE.Object3D();
    const flowerColors = ['#FF69B4', '#FF8C42', '#FFFFFF', '#FFD700'];
    const rng = createRng('flower-variation');

    points.forEach((point) => {
      const terrainY = terrainHeightAt(point.x, point.z);
      const stemHeight = 0.35 + rng() * 0.3;
      const bloomSize = 0.75 + rng() * 0.45;

      dummy.position.set(point.x, terrainY + stemHeight * 0.5, point.z);
      dummy.rotation.set((rng() * 2 - 1) * 0.09, point.rotation, (rng() * 2 - 1) * 0.09);
      dummy.scale.set(1, stemHeight, 1);
      dummy.updateMatrix();
      stemMatrixArray.push(dummy.matrix.clone());

      dummy.position.set(point.x, terrainY + stemHeight + bloomSize * 0.075, point.z);
      dummy.rotation.set(0, point.rotation * 0.5, 0);
      dummy.scale.set(bloomSize, bloomSize, bloomSize);
      dummy.updateMatrix();
      bloomMatrixArray.push(dummy.matrix.clone());
      bloomColorArray.push(new THREE.Color(flowerColors[Math.floor(rng() * flowerColors.length)]));
    });

    return {
      stemGeometry: stemGeometryMemo,
      stemMaterial: stemMaterialMemo,
      bloomGeometry: bloomGeometryMemo,
      bloomMaterial: bloomMaterialMemo,
      stemMatrices: stemMatrixArray,
      bloomMatrices: bloomMatrixArray,
      bloomColors: bloomColorArray,
    };
  }, [points]);

  useLayoutEffect(() => {
    if (!stemRef.current || !bloomRef.current) {
      return;
    }

    stemMatrices.forEach((matrix, index) => {
      stemRef.current?.setMatrixAt(index, matrix);
      bloomRef.current?.setMatrixAt(index, bloomMatrices[index]);
      bloomRef.current?.setColorAt(index, bloomColors[index]);
    });

    stemRef.current.instanceMatrix.needsUpdate = true;
    bloomRef.current.instanceMatrix.needsUpdate = true;
    if (bloomRef.current.instanceColor) {
      bloomRef.current.instanceColor.needsUpdate = true;
    }
  }, [bloomColors, bloomMatrices, stemMatrices]);

  return (
    <group>
      <instancedMesh ref={stemRef} args={[stemGeometry, stemMaterial, points.length]} castShadow receiveShadow />
      <instancedMesh ref={bloomRef} args={[bloomGeometry, bloomMaterial, points.length]} castShadow receiveShadow />
    </group>
  );
}

function MushroomField({ points }: { points: ScatterPoint[] }) {
  const stemRef = useRef<THREE.InstancedMesh>(null);
  const capRef = useRef<THREE.InstancedMesh>(null);

  const { stemGeometry, stemMaterial, capGeometry, capMaterial, stemMatrices, capMatrices, capColors } = useMemo(() => {
    const stemGeometryMemo = new THREE.CylinderGeometry(0.045, 0.06, 0.24, 8);
    const capGeometryMemo = new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const stemMaterialMemo = new THREE.MeshStandardMaterial({ color: '#F5F1E8', roughness: 0.92, metalness: 0 });
    const capMaterialMemo = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });

    const stemMatrixArray: THREE.Matrix4[] = [];
    const capMatrixArray: THREE.Matrix4[] = [];
    const capColorArray: THREE.Color[] = [];
    const dummy = new THREE.Object3D();
    const capColorsPalette = ['#F6EAD5', '#E8DCC5', '#DCC8A5'];
    const rng = createRng('mushroom-variation');

    points.forEach((point) => {
      const terrainY = terrainHeightAt(point.x, point.z);
      const stemHeight = 0.2 + rng() * 0.12;
      const capScale = 0.65 + rng() * 0.4;

      dummy.position.set(point.x, terrainY + stemHeight * 0.5, point.z);
      dummy.rotation.set((rng() * 2 - 1) * 0.07, point.rotation, (rng() * 2 - 1) * 0.07);
      dummy.scale.set(1, stemHeight, 1);
      dummy.updateMatrix();
      stemMatrixArray.push(dummy.matrix.clone());

      dummy.position.set(point.x, terrainY + stemHeight + capScale * 0.08, point.z);
      dummy.rotation.set(0, point.rotation, 0);
      dummy.scale.set(capScale, capScale * 0.9, capScale);
      dummy.updateMatrix();
      capMatrixArray.push(dummy.matrix.clone());
      capColorArray.push(new THREE.Color(capColorsPalette[Math.floor(rng() * capColorsPalette.length)]));
    });

    return {
      stemGeometry: stemGeometryMemo,
      stemMaterial: stemMaterialMemo,
      capGeometry: capGeometryMemo,
      capMaterial: capMaterialMemo,
      stemMatrices: stemMatrixArray,
      capMatrices: capMatrixArray,
      capColors: capColorArray,
    };
  }, [points]);

  useLayoutEffect(() => {
    if (!stemRef.current || !capRef.current) {
      return;
    }

    stemMatrices.forEach((matrix, index) => {
      stemRef.current?.setMatrixAt(index, matrix);
      capRef.current?.setMatrixAt(index, capMatrices[index]);
      capRef.current?.setColorAt(index, capColors[index]);
    });

    stemRef.current.instanceMatrix.needsUpdate = true;
    capRef.current.instanceMatrix.needsUpdate = true;
    if (capRef.current.instanceColor) {
      capRef.current.instanceColor.needsUpdate = true;
    }
  }, [capColors, capMatrices, stemMatrices]);

  return (
    <group>
      <instancedMesh ref={stemRef} args={[stemGeometry, stemMaterial, points.length]} castShadow receiveShadow />
      <instancedMesh ref={capRef} args={[capGeometry, capMaterial, points.length]} castShadow receiveShadow />
    </group>
  );
}

function PebbleField({ points }: { points: ScatterPoint[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const { geometry, material, matrices, colors } = useMemo(() => {
    const geometryMemo = new THREE.DodecahedronGeometry(0.22, 0);
    const materialMemo = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.03 });
    const matrixArray: THREE.Matrix4[] = [];
    const colorArray: THREE.Color[] = [];
    const dummy = new THREE.Object3D();
    const rng = createRng('pebble-variation');
    const palette = ['#B4B1AA', '#A3A099', '#C4C1BA', '#96928A'];

    points.forEach((point) => {
      const terrainY = terrainHeightAt(point.x, point.z);
      const pebbleScale = 0.35 + rng() * 0.45;
      dummy.position.set(point.x, terrainY + pebbleScale * 0.06, point.z);
      dummy.rotation.set(rng() * Math.PI, point.rotation, rng() * Math.PI);
      dummy.scale.set(pebbleScale, pebbleScale * (0.6 + rng() * 0.4), pebbleScale);
      dummy.updateMatrix();
      matrixArray.push(dummy.matrix.clone());
      colorArray.push(new THREE.Color(palette[Math.floor(rng() * palette.length)]));
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

  return <instancedMesh ref={meshRef} args={[geometry, material, points.length]} castShadow receiveShadow />;
}

type QuaterniusNatureProps = {
  point: ScatterPoint;
};

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
    <RigidBody
      type="fixed"
      colliders={false}
      position={[point.x, 0, point.z]}
      rotation={[point.tiltX, point.rotation, point.tiltZ]}
    >
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
    <RigidBody
      type="fixed"
      colliders={false}
      position={[point.x, 0, point.z]}
      rotation={[point.tiltX, point.rotation, point.tiltZ]}
    >
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
        count: 360,
        minRadiusFromCenter: CLEARING_RADIUS,
        edgePadding: 6,
        minSpacing: 1.2,
        minScale: 0.85,
        maxScale: 1.45,
        variantCount: 6,
      }),
    [],
  );

  const flowerPoints = useMemo(
    () =>
      generateScatterPoints({
        seed: 'flower-field',
        count: 40,
        minRadiusFromCenter: CLEARING_RADIUS + 1,
        edgePadding: 8,
        minSpacing: 3.4,
        minScale: 0.9,
        maxScale: 1.3,
        variantCount: 4,
      }),
    [],
  );

  const mushroomPoints = useMemo(
    () =>
      generateScatterPoints({
        seed: 'mushroom-patches',
        count: 20,
        minRadiusFromCenter: CLEARING_RADIUS + 2,
        edgePadding: 9,
        minSpacing: 4,
        minScale: 0.85,
        maxScale: 1.2,
        variantCount: 3,
      }),
    [],
  );

  const pebblePoints = useMemo(
    () =>
      generateScatterPoints({
        seed: 'pebble-field',
        count: 50,
        minRadiusFromCenter: CLEARING_RADIUS,
        edgePadding: 7,
        minSpacing: 2.2,
        minScale: 0.8,
        maxScale: 1.2,
        variantCount: 4,
      }),
    [],
  );

  const hedgeSegments = useMemo(() => {
    const rng = createRng('hedge-boundary');
    const segments: Array<{ x: number; z: number; scaleX: number; scaleY: number; scaleZ: number }> = [];
    const addSegment = (x: number, z: number, alongX: boolean) => {
      segments.push({
        x,
        z,
        scaleX: alongX ? 2.2 + rng() * 1.4 : 1.05 + rng() * 0.4,
        scaleY: 0.75 + rng() * 0.5,
        scaleZ: alongX ? 1.05 + rng() * 0.4 : 2.2 + rng() * 1.4,
      });
    };

    for (let index = -16; index <= 16; index += 1) {
      const sweep = index * 3;
      addSegment(sweep + (rng() * 2 - 1) * 0.35, -49.4 + (rng() * 2 - 1) * 0.35, true);
      addSegment(sweep + (rng() * 2 - 1) * 0.35, 49.4 + (rng() * 2 - 1) * 0.35, true);
      addSegment(-49.4 + (rng() * 2 - 1) * 0.35, sweep + (rng() * 2 - 1) * 0.35, false);
      addSegment(49.4 + (rng() * 2 - 1) * 0.35, sweep + (rng() * 2 - 1) * 0.35, false);
    }

    return segments;
  }, []);

  const logPoints = useMemo(() => generateLogs(), []);

  const geometry = useMemo(
    () => ({
      rock: new THREE.DodecahedronGeometry(1.1, 0),
      log: new THREE.CylinderGeometry(0.35, 0.35, 1, 8),
      hedge: new THREE.BoxGeometry(1, 1, 1),
      terrain: (() => {
        const terrainGeometry = new THREE.PlaneGeometry(100, 100, 200, 200);
        const positions = terrainGeometry.attributes.position as THREE.BufferAttribute;
        const colors = new Float32Array(positions.count * 3);
        const lowColor = new THREE.Color('#3E7B2F');
        const midColor = new THREE.Color('#5DAE44');
        const highColor = new THREE.Color('#8BC34A');
        const dirtColor = new THREE.Color('#8B7355');
        const blendedColor = new THREE.Color();

        for (let index = 0; index < positions.count; index += 1) {
          const x = positions.getX(index);
          const z = positions.getY(index);
          const height = terrainHeightAt(x, z);
          positions.setZ(index, height);

          const heightMix = THREE.MathUtils.clamp((height + 1.2) / 2.4, 0, 1);
          if (heightMix < 0.58) {
            blendedColor.copy(lowColor).lerp(midColor, heightMix / 0.58);
          } else {
            blendedColor.copy(midColor).lerp(highColor, (heightMix - 0.58) / 0.42);
          }

          const patchNoise =
            Math.sin(x * 0.35 + z * 0.23) * 0.5 +
            Math.sin(x * 0.92 - z * 0.61) * 0.25 +
            Math.sin(x * 0.15 - z * 0.18) * 0.25;
          const dirtStrength = THREE.MathUtils.smoothstep(patchNoise, 0.42, 0.74) * 0.45;
          blendedColor.lerp(dirtColor, dirtStrength);

          colors[index * 3] = blendedColor.r;
          colors[index * 3 + 1] = blendedColor.g;
          colors[index * 3 + 2] = blendedColor.b;
        }

        positions.needsUpdate = true;
        terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        terrainGeometry.computeVertexNormals();
        return terrainGeometry;
      })(),
    }),
    [],
  );

  const materials = useMemo(
    () => ({
      ground: new THREE.MeshStandardMaterial({
        roughness: 0.98,
        metalness: 0,
        vertexColors: true,
      }),
      rock: [
        new THREE.MeshStandardMaterial({ color: '#8F8A80', roughness: 0.9, metalness: 0.04 }),
        new THREE.MeshStandardMaterial({ color: '#9D968A', roughness: 0.9, metalness: 0.04 }),
        new THREE.MeshStandardMaterial({ color: '#7E7B72', roughness: 0.9, metalness: 0.04 }),
        new THREE.MeshStandardMaterial({ color: '#8B8171', roughness: 0.9, metalness: 0.04 }),
      ],
      log: new THREE.MeshStandardMaterial({ color: '#8D5A35', roughness: 0.94, metalness: 0.02 }),
      boundary: new THREE.MeshStandardMaterial({ color: '#436A35', roughness: 0.98, metalness: 0 }),
    }),
    [],
  );

  return (
    <group>
      <ambientLight intensity={0.15} color="#FFF5E0" />
      <hemisphereLight args={['#FFF1D0', '#5A8F3E', 0.6]} />
      <directionalLight
        castShadow
        intensity={1.4}
        color="#FFD080"
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
      <directionalLight intensity={0.3} color="#B4D4FF" position={[-30, 20, -20]} />

      <Sky sunPosition={[100, 20, 100]} turbidity={0.8} rayleigh={0.5} mieCoefficient={0.005} mieDirectionalG={0.8} />
      <Sparkles count={80} scale={[80, 20, 80]} size={3} speed={0.3} color="#FFD700" />
      <Cloud position={[-24, 34, -30]} opacity={0.2} speed={0.12} scale={[7, 2.2, 4]} segments={22} color="#FFF6EE" />
      <Cloud position={[8, 38, -6]} opacity={0.18} speed={0.08} scale={[6.4, 2, 3.8]} segments={20} color="#FFF9F2" />
      <Cloud position={[30, 32, 18]} opacity={0.16} speed={0.1} scale={[7.4, 2.3, 4.2]} segments={22} color="#FFF7EF" />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[MAP_HALF_SIZE, 0.3, MAP_HALF_SIZE]} position={[0, -0.3, 0]} />
        <mesh
          geometry={geometry.terrain}
          material={materials.ground}
          receiveShadow
          rotation-x={-Math.PI * 0.5}
          position={[0, 0, 0]}
        />
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[MAP_HALF_SIZE, 3, 0.9]} position={[0, 3, -50]} />
        <CuboidCollider args={[MAP_HALF_SIZE, 3, 0.9]} position={[0, 3, 50]} />
        <CuboidCollider args={[0.9, 3, MAP_HALF_SIZE]} position={[-50, 3, 0]} />
        <CuboidCollider args={[0.9, 3, MAP_HALF_SIZE]} position={[50, 3, 0]} />

        {hedgeSegments.map((segment, index) => (
          <mesh
            key={`hedge-${index}`}
            geometry={geometry.hedge}
            material={materials.boundary}
            position={[segment.x, segment.scaleY * 0.35, segment.z]}
            scale={[segment.scaleX, segment.scaleY, segment.scaleZ]}
            castShadow
            receiveShadow
          />
        ))}
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
        <RigidBody
          key={`log-${index}`}
          type="fixed"
          colliders={false}
          position={[log.x, log.radius + 0.04, log.z]}
          rotation={[0, log.rotationY, log.tiltZ]}
        >
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

      <PebbleField points={pebblePoints} />
      <MushroomField points={mushroomPoints} />
      <FlowerField points={flowerPoints} />
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
