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

const MODELS = {
  treesCommon: [1,2,3,4,5].map(i => `/models/megakit/CommonTree_${i}.glb`),
  treesPine: [1,2,3,4,5].map(i => `/models/megakit/Pine_${i}.glb`),
  treesTwisted: [1,2,3,4,5].map(i => `/models/megakit/TwistedTree_${i}.glb`),
  treesDead: [1,2,3,4,5].map(i => `/models/megakit/DeadTree_${i}.glb`),
  bushes: ['/models/megakit/Bush_Common.glb', '/models/megakit/Bush_Common_Flowers.glb'],
  plants: ['Plant_1', 'Plant_1_Big', 'Plant_7', 'Plant_7_Big', 'Fern_1', 'Clover_1', 'Clover_2'].map(p => `/models/megakit/${p}.glb`),
  flowers: ['Flower_3_Group', 'Flower_3_Single', 'Flower_4_Group', 'Flower_4_Single'].map(p => `/models/megakit/${p}.glb`),
  grass: ['Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Short', 'Grass_Wispy_Tall'].map(p => `/models/megakit/${p}.glb`),
  mushrooms: ['Mushroom_Common', 'Mushroom_Laetiporus'].map(p => `/models/megakit/${p}.glb`),
  rocks: [1,2,3].map(i => `/models/megakit/Rock_Medium_${i}.glb`),
  pebbles: [...[1,2,3,4,5].map(i=>`Pebble_Round_${i}`), ...[1,2,3,4,5,6].map(i=>`Pebble_Square_${i}`)].map(p => `/models/megakit/${p}.glb`),
  pathRocks: ['RockPath_Round_Small_1', 'RockPath_Round_Small_2', 'RockPath_Round_Small_3', 'RockPath_Round_Thin', 'RockPath_Round_Wide', 'RockPath_Square_Small_1', 'RockPath_Square_Small_2', 'RockPath_Square_Small_3', 'RockPath_Square_Thin', 'RockPath_Square_Wide'].map(p => `/models/megakit/${p}.glb`),
  petals: [1,2,3,4,5].map(i => `/models/megakit/Petal_${i}.glb`)
};

function InstancedGLTFGroup({ url, points, scaleMultiplier = 1, yOffset = 0 }: { url: string; points: ScatterPoint[], scaleMultiplier?: number, yOffset?: number }) {
  const { scene } = useGLTF(url);
  const meshes = useMemo(() => {
    const list: { mesh: THREE.Mesh; localMatrix: THREE.Matrix4 }[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        list.push({ mesh: child as THREE.Mesh, localMatrix: child.matrixWorld.clone() });
      }
    });
    return list;
  }, [scene]);

  return (
    <group>
      {meshes.map((item, index) => (
        <InstancedMeshPart key={index} mesh={item.mesh} localMatrix={item.localMatrix} points={points} scaleMultiplier={scaleMultiplier} yOffset={yOffset} />
      ))}
    </group>
  );
}

function InstancedMeshPart({ mesh, localMatrix, points, scaleMultiplier, yOffset }: { mesh: THREE.Mesh, localMatrix: THREE.Matrix4, points: ScatterPoint[], scaleMultiplier: number, yOffset: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const dummy = new THREE.Object3D();
    const mat = new THREE.Matrix4();
    points.forEach((point, i) => {
      const terrainY = terrainHeightAt(point.x, point.z);
      dummy.position.set(point.x, terrainY + yOffset, point.z);
      dummy.rotation.set(point.tiltX, point.rotation, point.tiltZ);
      const s = point.scale * scaleMultiplier;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();

      mat.multiplyMatrices(dummy.matrix, localMatrix);
      ref.current!.setMatrixAt(i, mat);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [points, localMatrix, scaleMultiplier, yOffset]);

  return (
    <instancedMesh ref={ref} args={[mesh.geometry, mesh.material, points.length]} castShadow receiveShadow />
  );
}

function InstancedNature({ points, paths, scaleMultiplier = 1, yOffset = 0 }: { points: ScatterPoint[], paths: string[], scaleMultiplier?: number, yOffset?: number }) {
  const pointGroups = useMemo(() => {
    const groups: Record<number, ScatterPoint[]> = {};
    for (let i = 0; i < paths.length; i++) groups[i] = [];
    points.forEach(p => {
      const idx = p.variant % paths.length;
      groups[idx].push(p);
    });
    return groups;
  }, [points, paths]);

  return (
    <group>
      {paths.map((url, idx) => (
        pointGroups[idx].length > 0 && (
          <InstancedGLTFGroup key={url} url={url} points={pointGroups[idx]} scaleMultiplier={scaleMultiplier} yOffset={yOffset} />
        )
      ))}
    </group>
  );
}

function RigidNature({ point, paths, collidersScale, colliderOffset = [0, 0, 0], scaleMultiplier = 1 }: { point: ScatterPoint, paths: string[], collidersScale: [number, number, number], colliderOffset?: [number, number, number], scaleMultiplier?: number }) {
  const url = paths[point.variant % paths.length];
  const gltf = useGLTF(url);
  const cloned = useMemo(() => {
    const c = gltf.scene.clone(true);
    c.traverse(child => { if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = true; }});
    return c;
  }, [gltf.scene]);

  const s = point.scale * scaleMultiplier;
  const terrainY = terrainHeightAt(point.x, point.z);
  
  const offY = colliderOffset[1] * s;

  return (
    <RigidBody type="fixed" colliders={false} position={[point.x, terrainY, point.z]} rotation={[point.tiltX, point.rotation, point.tiltZ]}>
      <CuboidCollider args={[collidersScale[0]*s, collidersScale[1]*s, collidersScale[2]*s]} position={[colliderOffset[0]*s, offY, colliderOffset[2]*s]} />
      <primitive object={cloned} scale={[s, s, s]} />
    </RigidBody>
  );
}

function MountainBackground() {
  const mountains = useMemo(() => {
    const rng = createRng('mountains');
    const m = [];
    for(let i=0; i<30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const radius = 150 + rng() * 50;
      m.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: 30 + rng() * 20,
        rotation: rng() * Math.PI,
      });
    }
    return m;
  }, []);

  return (
    <group>
      {mountains.map((m, i) => (
        <mesh key={i} position={[m.x, -10, m.z]} rotation={[0, m.rotation, 0]} scale={[m.scale, m.scale*1.5, m.scale]}>
          <coneGeometry args={[1, 1, 4]} />
          <meshBasicMaterial color="#5B8F9A" fog={true} />
        </mesh>
      ))}
    </group>
  );
}

export default function GameMap() {
  const treePoints = useMemo(() => {
    const points = generateScatterPoints({ seed: 'trees', count: 55, minRadiusFromCenter: CLEARING_RADIUS, edgePadding: 6, minSpacing: 4.5, minScale: 0.9, maxScale: 1.6, variantCount: 1 });
    const common: ScatterPoint[] = [];
    const pine: ScatterPoint[] = [];
    const twisted: ScatterPoint[] = [];
    const dead: ScatterPoint[] = [];
    const rng = createRng('tree-grouping');
    points.forEach(p => {
      if (Math.hypot(p.x, p.z) < 15 && rng() > 0.6) {
        dead.push({...p, variant: Math.floor(rng()*MODELS.treesDead.length)});
      } else if (p.x < 0 && p.z < 0) {
        pine.push({...p, variant: Math.floor(rng()*MODELS.treesPine.length)});
      } else if (p.x > 0 && p.z < 0) {
        twisted.push({...p, variant: Math.floor(rng()*MODELS.treesTwisted.length)});
      } else {
        common.push({...p, variant: Math.floor(rng()*MODELS.treesCommon.length)});
      }
    });
    return { common, pine, twisted, dead };
  }, []);

  const rockPoints = useMemo(() => generateScatterPoints({ seed: 'rocks', count: 15, minRadiusFromCenter: CLEARING_RADIUS, edgePadding: 8, minSpacing: 6, minScale: 1.0, maxScale: 1.8, variantCount: MODELS.rocks.length }), []);
  
  const focalRocks = useMemo(() => [
    { x: 12, z: 14, scale: 3.0, rotation: 0.4, tiltX: 0, tiltZ: 0, variant: 0 },
    { x: -15, z: 8, scale: 3.5, rotation: 1.2, tiltX: 0, tiltZ: 0, variant: 1 },
    { x: 5, z: -18, scale: 2.8, rotation: -0.8, tiltX: 0, tiltZ: 0, variant: 2 },
  ], []);

  const bushPoints = useMemo(() => generateScatterPoints({ seed: 'bushes', count: 12, minRadiusFromCenter: CLEARING_RADIUS, edgePadding: 10, minSpacing: 8, minScale: 1.2, maxScale: 1.8, variantCount: MODELS.bushes.length }), []);
  
  const grassPoints = useMemo(() => generateScatterPoints({ seed: 'grass', count: 80, minRadiusFromCenter: CLEARING_RADIUS-2, edgePadding: 6, minSpacing: 2, minScale: 0.8, maxScale: 1.4, variantCount: MODELS.grass.length }), []);
  const plantPoints = useMemo(() => generateScatterPoints({ seed: 'plants', count: 29, minRadiusFromCenter: CLEARING_RADIUS-1, edgePadding: 7, minSpacing: 3, minScale: 0.8, maxScale: 1.3, variantCount: MODELS.plants.length }), []);
  const flowerPoints = useMemo(() => generateScatterPoints({ seed: 'flowers', count: 25, minRadiusFromCenter: CLEARING_RADIUS, edgePadding: 8, minSpacing: 3.5, minScale: 0.9, maxScale: 1.3, variantCount: MODELS.flowers.length }), []);
  const mushroomPoints = useMemo(() => generateScatterPoints({ seed: 'mushrooms', count: 12, minRadiusFromCenter: CLEARING_RADIUS+2, edgePadding: 9, minSpacing: 4, minScale: 0.9, maxScale: 1.3, variantCount: MODELS.mushrooms.length }), []);
  const petalPoints = useMemo(() => generateScatterPoints({ seed: 'petals', count: 15, minRadiusFromCenter: CLEARING_RADIUS, edgePadding: 10, minSpacing: 4, minScale: 0.8, maxScale: 1.2, variantCount: MODELS.petals.length }), []);
  
  const { pathRocks, pathPebbles } = useMemo(() => {
    const rocks = [];
    const pebbles = [];
    const rng = createRng('path');
    for (let z = -45; z <= 45; z += 3.5) {
      const x = -Math.sin(z * 0.08) * 8;
      rocks.push({ x: x + (rng()-0.5)*1.5, z: z + (rng()-0.5)*1.5, scale: 0.8+rng()*0.4, rotation: rng()*Math.PI*2, tiltX: 0, tiltZ: 0, variant: Math.floor(rng()*MODELS.pathRocks.length) });
      if (rng() > 0.3) {
        pebbles.push({ x: x + (rng()-0.5)*3, z: z + (rng()-0.5)*3, scale: 0.6+rng()*0.5, rotation: rng()*Math.PI*2, tiltX: 0, tiltZ: 0, variant: Math.floor(rng()*MODELS.pebbles.length) });
      }
    }
    pebbles.push(...generateScatterPoints({ seed: 'pebbles', count: 15, minRadiusFromCenter: CLEARING_RADIUS, edgePadding: 7, minSpacing: 4, minScale: 0.8, maxScale: 1.2, variantCount: MODELS.pebbles.length }));
    return { pathRocks: rocks, pathPebbles: pebbles };
  }, []);

  const terrainGeometry = useMemo(() => {
    const geom = new THREE.PlaneGeometry(100, 100, 200, 200);
    const positions = geom.attributes.position as THREE.BufferAttribute;
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

      const pathDist = Math.abs(x + Math.sin(z * 0.08) * 8);
      const pathStrength = 1.0 - smoothstep(1.5, 4.5, pathDist);

      const patchNoise =
        Math.sin(x * 0.35 + z * 0.23) * 0.5 +
        Math.sin(x * 0.92 - z * 0.61) * 0.25 +
        Math.sin(x * 0.15 - z * 0.18) * 0.25;
      const dirtStrength = Math.max(pathStrength, THREE.MathUtils.smoothstep(patchNoise, 0.42, 0.74) * 0.45);
      
      blendedColor.lerp(dirtColor, dirtStrength);
      colors[index * 3] = blendedColor.r;
      colors[index * 3 + 1] = blendedColor.g;
      colors[index * 3 + 2] = blendedColor.b;
    }
    positions.needsUpdate = true;
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }, []);

  return (
    <group>
      <ambientLight intensity={0.2} color="#FFF5E0" />
      <hemisphereLight args={['#FFF1D0', '#5A8F3E', 0.55]} />
      <directionalLight
        castShadow
        intensity={1.6}
        color="#FFD080"
        position={[40, 50, 25]}
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
      <directionalLight intensity={0.35} color="#B4D4FF" position={[-30, 20, -20]} />

      <Sky sunPosition={[40, 50, 25]} turbidity={0.8} rayleigh={0.5} mieCoefficient={0.005} mieDirectionalG={0.8} />
      <Sparkles count={80} scale={[80, 20, 80]} size={6} speed={0.4} opacity={0.5} color="#FFD700" noise={1} />
      
      <Sparkles count={40} scale={[100, 10, 100]} size={12} speed={1.2} opacity={0.3} color="#FFFFFF" noise={0} />

      <Cloud position={[-24, 38, -30]} opacity={0.2} speed={0.12} scale={[7, 2.2, 4]} segments={22} color="#FFF6EE" />
      <Cloud position={[8, 42, -6]} opacity={0.25} speed={0.08} scale={[6.4, 2, 3.8]} segments={20} color="#FFF9F2" />
      <Cloud position={[30, 35, 18]} opacity={0.18} speed={0.1} scale={[7.4, 2.3, 4.2]} segments={22} color="#FFF7EF" />
      <Cloud position={[-40, 45, 20]} opacity={0.15} speed={0.09} scale={[8, 2.5, 4.5]} segments={20} color="#FFF5EA" />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[MAP_HALF_SIZE, 0.3, MAP_HALF_SIZE]} position={[0, -0.3, 0]} />
        <mesh
          geometry={terrainGeometry}
          receiveShadow
          rotation-x={-Math.PI * 0.5}
        >
          <meshStandardMaterial roughness={0.98} metalness={0} vertexColors={true} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[MAP_HALF_SIZE, 3, 0.9]} position={[0, 3, -50]} />
        <CuboidCollider args={[MAP_HALF_SIZE, 3, 0.9]} position={[0, 3, 50]} />
        <CuboidCollider args={[0.9, 3, MAP_HALF_SIZE]} position={[-50, 3, 0]} />
        <CuboidCollider args={[0.9, 3, MAP_HALF_SIZE]} position={[50, 3, 0]} />
      </RigidBody>

      <MountainBackground />

      {treePoints.common.map((p, i) => <RigidNature key={`tc-${i}`} point={p} paths={MODELS.treesCommon} collidersScale={[0.5, 3.5, 0.5]} colliderOffset={[0, 3.5, 0]} scaleMultiplier={1.5} />)}
      {treePoints.pine.map((p, i) => <RigidNature key={`tp-${i}`} point={p} paths={MODELS.treesPine} collidersScale={[0.6, 4, 0.6]} colliderOffset={[0, 4, 0]} scaleMultiplier={1.5} />)}
      {treePoints.twisted.map((p, i) => <RigidNature key={`tt-${i}`} point={p} paths={MODELS.treesTwisted} collidersScale={[0.5, 3.5, 0.5]} colliderOffset={[0, 3.5, 0]} scaleMultiplier={1.5} />)}
      {treePoints.dead.map((p, i) => <RigidNature key={`td-${i}`} point={p} paths={MODELS.treesDead} collidersScale={[0.4, 3.0, 0.4]} colliderOffset={[0, 3.0, 0]} scaleMultiplier={1.5} />)}

      {rockPoints.map((p, i) => <RigidNature key={`r-${i}`} point={p} paths={MODELS.rocks} collidersScale={[1.0, 1.0, 1.0]} colliderOffset={[0, 0.5, 0]} scaleMultiplier={2.5} />)}
      {focalRocks.map((p, i) => <RigidNature key={`fr-${i}`} point={p} paths={MODELS.rocks} collidersScale={[1.0, 1.0, 1.0]} colliderOffset={[0, 0.5, 0]} scaleMultiplier={2.5} />)}

      {bushPoints.map((p, i) => <RigidNature key={`b-${i}`} point={p} paths={MODELS.bushes} collidersScale={[0.8, 0.8, 0.8]} colliderOffset={[0, 0.8, 0]} scaleMultiplier={1.5} />)}

      <InstancedNature points={grassPoints} paths={MODELS.grass} scaleMultiplier={1.5} />
      <InstancedNature points={plantPoints} paths={MODELS.plants} scaleMultiplier={1.2} />
      <InstancedNature points={flowerPoints} paths={MODELS.flowers} scaleMultiplier={1.3} />
      <InstancedNature points={mushroomPoints} paths={MODELS.mushrooms} scaleMultiplier={1.2} />
      <InstancedNature points={pathRocks} paths={MODELS.pathRocks} scaleMultiplier={1.2} />
      <InstancedNature points={pathPebbles} paths={MODELS.pebbles} scaleMultiplier={1.2} />
      <InstancedNature points={petalPoints} paths={MODELS.petals} scaleMultiplier={1.2} />

    </group>
  );
}

Object.values(MODELS).flat().forEach(url => useGLTF.preload(url));