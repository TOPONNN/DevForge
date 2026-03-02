import { useGLTF } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { ENVIRONMENT_PROPS, type EnvironmentProp } from './props';

type ModelSource = 'nature' | 'treesGrassRocks' | 'treePack';
type ModelLibrary = Record<string, THREE.Object3D>;
type ModelLibraries = Record<ModelSource, ModelLibrary>;

const TREE_NAMES = [
  'TreeR1', 'TreeR2', 'TreeR3', 'TreeV1', 'TreeV2', 'TreeV3', 'TreeD1', 'TreeD2', 'TreeD3',
  'TreeRC1', 'TreeRC2', 'TreeRC3', 'TreeVC', 'TreeDC', 'TreeRF', 'TreeO1', 'TreeO2',
] as const;

const ROCK_NAMES = ['RB1', 'RB2', 'RB3', 'RB4', 'RB5', 'RB6', 'RBi1', 'RBi2', 'RBi3', 'RBi4', 'RBg1', 'RBg2', 'RBg3', 'RBg4'] as const;
const GRASS_NAMES = ['RG1', 'RG2', 'RG3', 'RG4', 'RG5', 'RG6', 'GrassClump1', 'Clump2', 'Clump3', 'Clump4', 'Clump5', 'Clump6', 'Clump7', 'Clump8'] as const;
const BUSH_NAMES = ['Bush1', 'Bush2'] as const;
const CLIFF_NAMES = ['ClifGg2', 'ClifGi1', 'ClifBg1', 'ClifBg2', 'ClifBi1', 'ClifGg3'] as const;
const TREE_PACK_NAMES = ['01-tree-root', '02-tree-root', '03-tree-root', '04-tree-root', '05-tree-root'] as const;

function seededValue(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

function seededRange(seed: string, min: number, max: number) {
  return min + seededValue(seed) * (max - min);
}

function pickBySeed<T extends string>(seed: string, values: readonly T[]): T {
  return values[Math.floor(seededValue(seed) * values.length) % values.length];
}

function cloneSceneObject(template: THREE.Object3D | null) {
  if (!template) {
    return null;
  }
  const clone = template.clone(true);
  clone.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => material.clone());
    } else {
      mesh.material = mesh.material.clone();
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  return clone;
}

function buildModelLibrary(scene: THREE.Object3D) {
  const library: ModelLibrary = {};
  scene.traverse((child) => {
    if (child.name) {
      library[child.name] = child;
    }
  });
  return library;
}

function ClonedModel({
  template,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: {
  template: THREE.Object3D | null;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const object = useMemo(() => cloneSceneObject(template), [template]);
  if (!object) {
    return null;
  }
  return <primitive object={object} position={position} rotation={rotation} scale={scale} />;
}

function getModelTemplate(libraries: ModelLibraries, source: ModelSource, name: string) {
  return libraries[source][name] ?? null;
}

function EnvironmentObject({ prop, libraries }: { prop: EnvironmentProp; libraries: ModelLibraries }) {
  if (prop.type === 'road') {
    return (
      <mesh position={prop.position} rotation={[0, prop.rotationY, 0]} receiveShadow>
        <boxGeometry args={prop.size} />
        <meshStandardMaterial color={prop.color} roughness={0.92} metalness={0.02} />
      </mesh>
    );
  }

  const colliderArgs: [number, number, number] = [prop.size[0] * 0.5, prop.size[1] * 0.5, prop.size[2] * 0.5];
  const baseHeightOffset = -prop.size[1] * 0.5;

  if (prop.type === 'tree') {
    const source: ModelSource = seededValue(`${prop.id}-tree-pack`) > 0.75 ? 'treePack' : 'nature';
    const selectedName = source === 'nature'
      ? pickBySeed(`${prop.id}-tree`, TREE_NAMES)
      : pickBySeed(`${prop.id}-treepack`, TREE_PACK_NAMES);
    const template = getModelTemplate(libraries, source, selectedName);
    const yawJitter = seededRange(`${prop.id}-yaw`, -0.35, 0.35);
    const treeScale = (prop.size[1] / 3.6) * seededRange(`${prop.id}-scale`, 1.05, 1.45);

    return (
      <RigidBody type="fixed" colliders={false} position={prop.position} rotation={[0, prop.rotationY + yawJitter, 0]}>
        <CuboidCollider args={colliderArgs} />
        <ClonedModel template={template} position={[0, baseHeightOffset + 0.02, 0]} scale={treeScale} />
      </RigidBody>
    );
  }

  if (prop.type === 'rock') {
    const selectedName = pickBySeed(`${prop.id}-rock`, ROCK_NAMES);
    const template = getModelTemplate(libraries, 'nature', selectedName);
    const yawJitter = seededRange(`${prop.id}-yaw`, -0.4, 0.4);
    const rockScale = (prop.size[1] / 1.5) * seededRange(`${prop.id}-scale`, 0.92, 1.28);

    return (
      <RigidBody type="fixed" colliders={false} position={prop.position} rotation={[0, prop.rotationY + yawJitter, 0]}>
        <CuboidCollider args={colliderArgs} />
        <ClonedModel template={template} position={[0, baseHeightOffset + 0.02, 0]} scale={rockScale} />
      </RigidBody>
    );
  }

  if (prop.type === 'tall_grass') {
    const selectedName = pickBySeed(`${prop.id}-grass`, GRASS_NAMES);
    const template = getModelTemplate(libraries, 'nature', selectedName);
    const yawJitter = seededRange(`${prop.id}-yaw`, -0.5, 0.5);
    const grassScale = (prop.size[0] / 3.3) * seededRange(`${prop.id}-scale`, 1.2, 1.8);

    return (
      <RigidBody type="fixed" colliders={false} position={prop.position} rotation={[0, prop.rotationY + yawJitter, 0]}>
        <CuboidCollider args={colliderArgs} />
        <ClonedModel template={template} position={[0, baseHeightOffset + 0.02, 0]} scale={grassScale} />
      </RigidBody>
    );
  }

  if (prop.type === 'berry_bush') {
    const selectedName = pickBySeed(`${prop.id}-bush`, BUSH_NAMES);
    const template = getModelTemplate(libraries, 'treesGrassRocks', selectedName);
    const yawJitter = seededRange(`${prop.id}-yaw`, -0.35, 0.35);
    const bushScale = (prop.size[0] / 1.45) * seededRange(`${prop.id}-scale`, 1.05, 1.35);

    return (
      <RigidBody type="fixed" colliders={false} position={prop.position} rotation={[0, prop.rotationY + yawJitter, 0]}>
        <CuboidCollider args={colliderArgs} />
        <ClonedModel template={template} position={[0, baseHeightOffset + 0.05, 0]} scale={bushScale} />
      </RigidBody>
    );
  }

  if (prop.type === 'building') {
    const centerCliff = getModelTemplate(libraries, 'nature', pickBySeed(`${prop.id}-cliff`, CLIFF_NAMES));
    const treeLeft = getModelTemplate(libraries, 'nature', pickBySeed(`${prop.id}-tree-left`, TREE_NAMES));
    const treeRight = getModelTemplate(libraries, 'nature', pickBySeed(`${prop.id}-tree-right`, TREE_NAMES));
    const rockA = getModelTemplate(libraries, 'nature', pickBySeed(`${prop.id}-rock-a`, ROCK_NAMES));
    const rockB = getModelTemplate(libraries, 'nature', pickBySeed(`${prop.id}-rock-b`, ROCK_NAMES));

    const yawJitter = seededRange(`${prop.id}-yaw`, -0.2, 0.2);
    const footprint = (prop.size[0] + prop.size[2]) * 0.5;
    const cliffScale = (footprint / 10) * seededRange(`${prop.id}-cliff-scale`, 1.7, 2.3);
    const treeScale = (prop.size[1] / 4.4) * seededRange(`${prop.id}-tree-scale`, 1.1, 1.55);
    const rockScale = (prop.size[1] / 4.4) * seededRange(`${prop.id}-rock-scale`, 1.15, 1.45);
    const edgeX = prop.size[0] * 0.35;
    const edgeZ = prop.size[2] * 0.3;

    return (
      <RigidBody type="fixed" colliders={false} position={prop.position} rotation={[0, prop.rotationY + yawJitter, 0]}>
        <CuboidCollider args={colliderArgs} />
        <group position={[0, baseHeightOffset, 0]}>
          <ClonedModel template={centerCliff} position={[0, 0.15, 0]} scale={cliffScale} />
          <ClonedModel template={treeLeft} position={[-edgeX, 0.05, edgeZ]} rotation={[0, seededRange(`${prop.id}-tree-left-yaw`, -0.6, 0.6), 0]} scale={treeScale} />
          <ClonedModel template={treeRight} position={[edgeX, 0.05, -edgeZ]} rotation={[0, seededRange(`${prop.id}-tree-right-yaw`, -0.6, 0.6), 0]} scale={treeScale} />
          <ClonedModel template={rockA} position={[-edgeX * 0.65, 0.05, -edgeZ * 0.95]} rotation={[0, seededRange(`${prop.id}-rock-a-yaw`, -0.8, 0.8), 0]} scale={rockScale} />
          <ClonedModel template={rockB} position={[edgeX * 0.75, 0.05, edgeZ * 0.95]} rotation={[0, seededRange(`${prop.id}-rock-b-yaw`, -0.8, 0.8), 0]} scale={rockScale} />
        </group>
      </RigidBody>
    );
  }

  return (
    <RigidBody type="fixed" colliders={false} position={prop.position} rotation={[0, prop.rotationY, 0]}>
      <CuboidCollider args={colliderArgs} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={prop.size} />
        <meshStandardMaterial color={prop.color} roughness={0.82} />
      </mesh>
    </RigidBody>
  );
}

function EnvironmentPropsLayer() {
  const nature = useGLTF('/models/nature-stylized-pack.glb');
  const treesGrassRocks = useGLTF('/models/trees-grass-rocks.glb');
  const treePack = useGLTF('/models/stylized-tree-pack.glb');

  const libraries = useMemo<ModelLibraries>(() => ({
    nature: buildModelLibrary(nature.scene),
    treesGrassRocks: buildModelLibrary(treesGrassRocks.scene),
    treePack: buildModelLibrary(treePack.scene),
  }), [nature.scene, treePack.scene, treesGrassRocks.scene]);

  return (
    <>
      {ENVIRONMENT_PROPS.map((prop) => (
        <EnvironmentObject key={prop.id} prop={prop} libraries={libraries} />
      ))}
    </>
  );
}

export default function GameMap() {
  return (
    <group>
      <hemisphereLight args={['#C9F2FF', '#87B957', 0.72]} />
      <directionalLight
        castShadow
        intensity={1.35}
        color="#FFE8A3"
        position={[40, 50, 20]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00015}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[80, 0.25, 80]} position={[0, -0.25, 0]} />
        <mesh receiveShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[160, 0.5, 160]} />
          <meshStandardMaterial color="#67C25E" roughness={0.88} metalness={0.02} />
        </mesh>
      </RigidBody>

      <mesh position={[0, 22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[400, 64]} />
        <meshBasicMaterial color="#A9E6FF" side={THREE.DoubleSide} />
      </mesh>

      <group>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[3.6, 1.7, 2.3]} position={[0, 1.7, -1.5]} />
          <mesh position={[0, 1.7, -1.5]} castShadow receiveShadow>
            <boxGeometry args={[7.2, 3.4, 4.6]} />
            <meshStandardMaterial color="#FF8787" roughness={0.65} />
          </mesh>
          <mesh position={[0, 3.65, -1.5]} castShadow>
            <boxGeometry args={[8, 0.7, 5.2]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
          </mesh>
          <mesh position={[0, 2.45, 0.85]}>
            <boxGeometry args={[1.8, 1.4, 0.2]} />
            <meshStandardMaterial color="#E63946" emissive="#E63946" emissiveIntensity={0.16} />
          </mesh>
        </RigidBody>
      </group>

      <Suspense fallback={null}>
        <EnvironmentPropsLayer />
      </Suspense>
    </group>
  );
}

useGLTF.preload('/models/nature-stylized-pack.glb');
useGLTF.preload('/models/trees-grass-rocks.glb');
useGLTF.preload('/models/stylized-tree-pack.glb');
