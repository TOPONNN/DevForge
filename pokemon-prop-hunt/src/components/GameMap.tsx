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
      <hemisphereLight args={['#FFF1CE', '#8FB46A', 0.8]} />
      <directionalLight
        castShadow
        intensity={1.2}
        color="#FFDFA8"
        position={[34, 46, 24]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00015}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
      />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[50, 0.25, 50]} position={[0, -0.25, 0]} />
        <mesh receiveShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[100, 0.5, 100]} />
          <meshStandardMaterial color="#78C850" roughness={0.9} metalness={0.01} />
        </mesh>
      </RigidBody>

      <group>
        <mesh position={[0, 0.04, 0]} receiveShadow>
          <cylinderGeometry args={[6.3, 6.3, 0.12, 48]} />
          <meshStandardMaterial color="#A6ABB2" roughness={0.86} metalness={0.08} />
        </mesh>
        <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[5.6, 6, 0.4, 48]} />
          <meshStandardMaterial color="#C2C8CF" roughness={0.82} metalness={0.04} />
        </mesh>
        <mesh position={[0, 0.33, 0]} receiveShadow>
          <cylinderGeometry args={[4.4, 4.4, 0.1, 40]} />
          <meshStandardMaterial color="#66C6E8" roughness={0.3} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.6, 0.9, 1.2, 24]} />
          <meshStandardMaterial color="#B8BFC7" roughness={0.68} metalness={0.16} />
        </mesh>
      </group>

      <group>
        <mesh position={[0, 0.03, -14]} rotation={[0, 0.22, 0]} receiveShadow>
          <boxGeometry args={[7, 0.06, 12]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>
        <mesh position={[4, 0.03, -25]} rotation={[0, -0.14, 0]} receiveShadow>
          <boxGeometry args={[7.5, 0.06, 11]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>
        <mesh position={[8, 0.03, -36]} rotation={[0, 0.08, 0]} receiveShadow>
          <boxGeometry args={[6.5, 0.06, 10]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>

        <mesh position={[14, 0.03, -2]} rotation={[0, Math.PI * 0.5 + 0.2, 0]} receiveShadow>
          <boxGeometry args={[7, 0.06, 12]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>
        <mesh position={[26, 0.03, -6]} rotation={[0, Math.PI * 0.5 - 0.1, 0]} receiveShadow>
          <boxGeometry args={[7.2, 0.06, 11]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>
        <mesh position={[37, 0.03, -9]} rotation={[0, Math.PI * 0.5 + 0.12, 0]} receiveShadow>
          <boxGeometry args={[6.8, 0.06, 10]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>

        <mesh position={[-12, 0.03, 6]} rotation={[0, Math.PI * 0.5 - 0.25, 0]} receiveShadow>
          <boxGeometry args={[7.5, 0.06, 12]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>
        <mesh position={[-24, 0.03, 14]} rotation={[0, Math.PI * 0.5 + 0.1, 0]} receiveShadow>
          <boxGeometry args={[7.2, 0.06, 11]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>
        <mesh position={[-35, 0.03, 20]} rotation={[0, Math.PI * 0.5 - 0.08, 0]} receiveShadow>
          <boxGeometry args={[6.8, 0.06, 10]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>

        <mesh position={[2, 0.03, 14]} rotation={[0, -0.18, 0]} receiveShadow>
          <boxGeometry args={[7, 0.06, 12]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>
        <mesh position={[-3, 0.03, 25]} rotation={[0, 0.16, 0]} receiveShadow>
          <boxGeometry args={[7.2, 0.06, 11]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>
        <mesh position={[-8, 0.03, 36]} rotation={[0, -0.08, 0]} receiveShadow>
          <boxGeometry args={[6.8, 0.06, 10]} />
          <meshStandardMaterial color="#A6A9AF" roughness={0.94} metalness={0.02} />
        </mesh>
      </group>

      <mesh position={[0, 22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[400, 64]} />
        <meshBasicMaterial color="#87CEEB" side={THREE.DoubleSide} />
      </mesh>

      <Suspense fallback={null}>
        <EnvironmentPropsLayer />
      </Suspense>
    </group>
  );
}

useGLTF.preload('/models/nature-stylized-pack.glb');
useGLTF.preload('/models/trees-grass-rocks.glb');
useGLTF.preload('/models/stylized-tree-pack.glb');
