import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useAnimations, useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { PokemonSpecies, RotationTuple, Vector3Tuple } from '../types/game';

const MODEL_MAP: Record<string, string> = {
  Bulbasaur: '/models/bulbasaur.glb',
  Ivysaur: '/models/ivysaur.glb',
  Venusaur: '/models/venusaur.glb',
  Charmander: '/models/charmander.glb',
  Charmeleon: '/models/charmeleon.glb',
  Charizard: '/models/charizard.glb',
  Squirtle: '/models/squirtle.glb',
  Wartortle: '/models/wartortle.glb',
  Blastoise: '/models/blastoise.glb',
};

const TARGET_HEIGHTS: Record<string, number> = {
  Bulbasaur: 1.2,
  Ivysaur: 1.2,
  Venusaur: 1.8,
  Charmander: 1.0,
  Charmeleon: 1.2,
  Charizard: 1.8,
  Squirtle: 1.0,
  Wartortle: 1.2,
  Blastoise: 1.8,
};

const ANIMATION_MAP: Record<string, { idle: string; walk: string; run?: string }> = {
  Bulbasaur: { idle: 'waitA01', walk: 'walk01' },
  Ivysaur: { idle: 'defaultwait01_loop', walk: 'walk01_loop', run: 'run01_loop' },
  Venusaur: { idle: 'waitA01', walk: 'walk01' },
  Charmander: { idle: 'loop01', walk: 'walk01' },
  Charmeleon: { idle: 'loop01', walk: 'walk01' },
  Charizard: { idle: 'loop01', walk: 'walk01' },
  Squirtle: { idle: 'defaultwait01_loop.tranm', walk: 'walk01_loop.tranm' },
  Wartortle: { idle: 'waitA01', walk: 'walk01' },
  Blastoise: { idle: 'waitA01', walk: 'walk01' },
};

type GLTFAsset = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

type ModelAsset = {
  clone: THREE.Group;
  normalizedScale: number;
  center: THREE.Vector3;
  minY: number;
};

function PokemonModelGLTF({
  species,
  modelPath,
  isMoving,
}: {
  species: PokemonSpecies;
  modelPath: string;
  isMoving: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(modelPath) as GLTFAsset;

  const asset = useMemo<ModelAsset>(() => {
    const clone = scene.clone(true);

    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (Array.isArray(object.material)) {
          object.material = object.material.map((material) => material.clone());
        } else {
          object.material = object.material.clone();
        }
      }
    });

    const bounds = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    const center = new THREE.Vector3();
    bounds.getCenter(center);

    const actualHeight = size.y;
    const targetHeight = TARGET_HEIGHTS[species.name] ?? 1.0;
    const normalizedScale =
      actualHeight > 0.001 ? (targetHeight * species.modelScale) / actualHeight : species.modelScale;

    return {
      clone,
      normalizedScale,
      center,
      minY: bounds.min.y,
    };
  }, [scene, species.modelScale, species.name]);

  const { actions } = useAnimations(animations, group);
  const animMap = ANIMATION_MAP[species.name];

  useEffect(() => {
    if (!actions || !animMap) {
      return;
    }

    const idleAction = actions[animMap.idle];
    const walkAction = actions[animMap.walk] ?? (animMap.run ? actions[animMap.run] : undefined);

    Object.values(actions).forEach((action) => action?.stop());

    const activeAction = isMoving && walkAction ? walkAction : idleAction;
    if (activeAction) {
      activeAction.reset().fadeIn(0.3).play();
    }

    return () => {
      activeAction?.fadeOut(0.3);
    };
  }, [isMoving, actions, animMap]);

  return (
    <group ref={group} scale={asset.normalizedScale} rotation={[0, Math.PI, 0]}>
      <primitive object={asset.clone} position={[-asset.center.x, -asset.minY, -asset.center.z]} />
    </group>
  );
}

interface PokemonCharacterProps {
  id: string;
  name: string;
  species: PokemonSpecies;
  position: Vector3Tuple;
  rotation: RotationTuple;
  isMoving: boolean;
  escaping: boolean;
  invulnerable: boolean;
  isCaught: boolean;
}

function PokemonBody({ species }: { species: PokemonSpecies }) {
  if (species.name === 'Venusaur' || species.name === 'Charizard' || species.name === 'Blastoise') {
    return <capsuleGeometry args={[0.7 * species.modelScale, 1 * species.modelScale, 12, 18]} />;
  }
  if (species.name === 'Charmander' || species.name === 'Squirtle') {
    return <capsuleGeometry args={[0.45 * species.modelScale, 0.85 * species.modelScale, 10, 16]} />;
  }
  if (species.name === 'Bulbasaur' || species.name === 'Ivysaur' || species.name === 'Wartortle') {
    return <dodecahedronGeometry args={[0.62 * species.modelScale, 0]} />;
  }
  if (species.name === 'Charmeleon') {
    return <dodecahedronGeometry args={[0.5 * species.modelScale, 1]} />;
  }
  return <sphereGeometry args={[0.56 * species.modelScale, 24, 24]} />;
}

export default function PokemonCharacter({
  id,
  name,
  species,
  position,
  rotation,
  isMoving,
  escaping,
  invulnerable,
  isCaught,
}: PokemonCharacterProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const bodyRef = useRef<THREE.Group | null>(null);
  const flashMaterialsRef = useRef<THREE.Material[]>([]);

  const trailOffsets = useMemo(
    () => [
      [-0.2, 0.2, -0.4],
      [0.15, 0.1, -0.65],
      [0, 0.25, -0.9],
    ] as Vector3Tuple[],
    [],
  );

  useFrame(({ clock }) => {
    const group = groupRef.current;
    const body = bodyRef.current;
    if (!group || !body) {
      return;
    }

    const t = clock.getElapsedTime();
    const bobSpeed = isMoving ? 9 : 3.5;
    const bobHeight = isMoving ? 0.12 : 0.05;
    group.position.set(position[0], position[1] + Math.sin(t * bobSpeed + id.length) * bobHeight, position[2]);
    group.rotation.y = rotation[1];
    group.visible = !isCaught;

    body.rotation.z = isMoving ? Math.sin(t * 8) * 0.05 : 0;
    body.rotation.x = isMoving ? -0.1 : 0;

    const opacity = invulnerable ? 0.45 + Math.abs(Math.sin(t * 16)) * 0.4 : 1;
    for (const material of flashMaterialsRef.current) {
      if ('opacity' in material) {
        material.opacity = opacity;
      }
    }
  });

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    const materials = new Set<THREE.Material>();
    body.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of meshMaterials) {
        if (!material || !('opacity' in material)) {
          continue;
        }
        material.transparent = true;
        materials.add(material);
      }
    });

    flashMaterialsRef.current = [...materials];

    return () => {
      for (const material of flashMaterialsRef.current) {
        if ('opacity' in material) {
          material.opacity = 1;
        }
      }
      flashMaterialsRef.current = [];
    };
  }, [species.name]);

  return (
    <group ref={groupRef}>
      <group ref={bodyRef}>
        {MODEL_MAP[species.name] ? (
          <Suspense
            fallback={
              <mesh castShadow>
                <PokemonBody species={species} />
                <meshStandardMaterial color={species.color} roughness={0.35} metalness={0.08} transparent />
              </mesh>
            }
          >
            <PokemonModelGLTF species={species} modelPath={MODEL_MAP[species.name]} isMoving={isMoving} />
          </Suspense>
        ) : (
          <mesh castShadow>
            <PokemonBody species={species} />
            <meshStandardMaterial color={species.color} roughness={0.35} metalness={0.08} transparent />
          </mesh>
        )}
      </group>

      {escaping
        ? trailOffsets.map((offset, idx) => (
            <mesh key={`${id}-trail-${idx}`} position={offset}>
              <sphereGeometry args={[0.09 + idx * 0.03, 12, 12]} />
              <meshBasicMaterial color="#4CC9F0" transparent opacity={0.5 - idx * 0.12} />
            </mesh>
          ))
        : null}

      <Text position={[0, 1.3, 0]} fontSize={0.22} color="#FFFFFF" outlineColor="#1D3557" outlineWidth={0.04}>
        {name}
      </Text>
    </group>
  );
}

useGLTF.preload('/models/bulbasaur.glb');
useGLTF.preload('/models/ivysaur.glb');
useGLTF.preload('/models/venusaur.glb');
useGLTF.preload('/models/charmander.glb');
useGLTF.preload('/models/charmeleon.glb');
useGLTF.preload('/models/charizard.glb');
useGLTF.preload('/models/squirtle.glb');
useGLTF.preload('/models/wartortle.glb');
useGLTF.preload('/models/blastoise.glb');
