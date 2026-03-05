import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import type { PokemonSpecies, RotationTuple, Vector3Tuple } from '../types/game';

const MODEL_MAP: Record<string, string> = {
  Bulbasaur: '/models/bulbasaur.glb?v=2',
  Ivysaur: '/models/ivysaur.glb?v=2',
  Venusaur: '/models/venusaur.glb?v=2',
  Charmander: '/models/charmander.glb?v=2',
  Charmeleon: '/models/charmeleon.glb?v=2',
  Charizard: '/models/charizard.glb?v=2',
  Squirtle: '/models/squirtle.glb?v=2',
  Wartortle: '/models/wartortle.glb?v=2',
  Blastoise: '/models/blastoise.glb?v=2',
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

// Corrected fallback scales: these match what updateMatrixWorld + Box3 produces.
// Most models have Armature root scale 10 baked into the world matrix,
// so Box3 reports the full baked height. scale = targetHeight * modelScale / bakedHeight.
// Ivysaur is the exception with Armature scale 1.
const FALLBACK_SCALES: Record<string, number> = {
  Bulbasaur: 0.0806,
  Ivysaur: 0.945,
  Venusaur: 0.094,
  Charmander: 0.1672,
  Charmeleon: 0.1057,
  Charizard: 0.1036,
  Squirtle: 0.2276,
  Wartortle: 0.0897,
  Blastoise: 0.1306,
};

// Verified against actual GLB animation clip names (parsed from binary GLTF data)
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

function PokemonModelGLTF({
  species,
  modelPath,
  isMoving,
}: {
  species: PokemonSpecies;
  modelPath: string;
  isMoving: boolean;
}) {
  const { scene, animations } = useGLTF(modelPath);

  // Clone scene using SkeletonUtils from three-stdlib
  const { clonedScene, normalizedScale, minY, center } = useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);

    // Set up materials for shadows + fix SkinnedMesh frustum culling
    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => mat.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
      }
      // Prevent animated SkinnedMesh from disappearing due to stale bind-pose bounds
      if ((child as any).isSkinnedMesh) {
        (child as THREE.SkinnedMesh).frustumCulled = false;
      }
    });

    // CRITICAL: Force world matrix computation on the freshly cloned scene.
    // Without this, Box3.setFromObject uses stale/identity matrices,
    // giving wrong bounds for models with non-identity root transforms (Armature scale 10).
    cloned.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const ctr = new THREE.Vector3();

    if (bounds.isEmpty() || !isFinite(bounds.min.x)) {
      const fallback = FALLBACK_SCALES[species.name] ?? species.modelScale;
      console.warn(`[Pokemon] ${species.name}: bounds empty, using fallback scale ${fallback}`);
      return {
        clonedScene: cloned,
        normalizedScale: fallback,
        minY: 0,
        center: new THREE.Vector3(0, 0, 0),
      };
    }

    bounds.getSize(size);
    bounds.getCenter(ctr);

    const actualHeight = size.y;
    const targetHeight = TARGET_HEIGHTS[species.name] ?? 1.0;
    let scale =
      actualHeight > 0.001 ? (targetHeight * species.modelScale) / actualHeight : species.modelScale;

    // Sanity check: if computed scale differs >5x from known fallback, prefer fallback
    const fallback = FALLBACK_SCALES[species.name];
    if (fallback && isFinite(scale)) {
      const ratio = scale / fallback;
      if (ratio > 5 || ratio < 0.2) {
        console.warn(
          `[Pokemon] ${species.name}: computed scale ${scale.toFixed(6)} differs >5x from expected ${fallback.toFixed(6)} (actualH=${actualHeight.toFixed(2)}). Using fallback.`,
        );
        scale = fallback;
      }
    }

    if (!isFinite(scale)) {
      scale = fallback ?? species.modelScale;
    }

    console.log(
      `[Pokemon] ${species.name}: actualH=${actualHeight.toFixed(2)}, targetH=${targetHeight}, scale=${scale.toFixed(6)}, minY=${bounds.min.y.toFixed(2)}`,
    );

    return {
      clonedScene: cloned,
      normalizedScale: scale,
      minY: isFinite(bounds.min.y) ? bounds.min.y : 0,
      center: ctr,
    };
  }, [scene, species.modelScale, species.name]);

  // --- Animation: manual mixer bound to clonedScene (Oracle-recommended pattern) ---
  // Binding to clonedScene (not a group wrapper) ensures bones are found directly.
  const mixer = useMemo(() => new THREE.AnimationMixer(clonedScene), [clonedScene]);

  const clipsByName = useMemo(() => {
    const m: Record<string, THREE.AnimationClip> = {};
    for (const c of animations) m[c.name] = c;
    return m;
  }, [animations]);

  const currentAction = useRef<THREE.AnimationAction | null>(null);

  // Update mixer every frame
  useFrame((_, delta) => mixer.update(delta));

  // Switch animation on isMoving change (also starts idle on mount)
  useEffect(() => {
    const animMap = ANIMATION_MAP[species.name];
    if (!animMap) return;

    const idleClip = clipsByName[animMap.idle];
    const walkClip = clipsByName[animMap.walk] ?? (animMap.run ? clipsByName[animMap.run] : undefined);
    const nextClip = isMoving && walkClip ? walkClip : idleClip;

    if (!nextClip) {
      console.warn(`[Pokemon] ${species.name}: clip not found! idle="${animMap.idle}" walk="${animMap.walk}"`);
      return;
    }

    const next = mixer.clipAction(nextClip);
    next.setLoop(THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = false;
    next.reset().fadeIn(0.3).play();

    if (currentAction.current && currentAction.current !== next) {
      currentAction.current.fadeOut(0.3);
    }
    currentAction.current = next;

    return () => {
      next.fadeOut(0.3);
    };
  }, [isMoving, mixer, clipsByName, species.name]);

  // Cleanup mixer on unmount or model swap
  useEffect(() => {
    // Log clip names for debugging
    const animMap = ANIMATION_MAP[species.name];
    const clipNames = animations.map((c) => c.name);
    console.log(
      `[Pokemon] ${species.name}: ${animations.length} clips [${clipNames.slice(0, 5).join(', ')}${clipNames.length > 5 ? '...' : ''}]`,
      `idle="${animMap?.idle}" walk="${animMap?.walk}"`,
    );
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      // Dispose cloned materials & geometries to free GPU memory
      clonedScene.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) return;
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (mat && typeof mat.dispose === 'function') mat.dispose();
        }
      });
    };
  }, [mixer, clonedScene, animations, species.name]);

  return (
    <group scale={normalizedScale} rotation={[0, Math.PI, 0]}>
      <primitive object={clonedScene} position={[-center.x, -minY, -center.z]} />
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
  const targetPositionRef = useRef(new THREE.Vector3(position[0], position[1], position[2]));
  const initializedRef = useRef(false);

  const trailOffsets = useMemo(
    () => [
      [-0.2, 0.2, -0.4],
      [0.15, 0.1, -0.65],
      [0, 0.25, -0.9],
    ] as Vector3Tuple[],
    [],
  );

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;
    const body = bodyRef.current;
    if (!group || !body) {
      return;
    }

    const t = clock.getElapsedTime();

    // Update target position — no bobbing, stay grounded
    targetPositionRef.current.set(position[0], position[1], position[2]);

    if (!initializedRef.current) {
      group.position.copy(targetPositionRef.current);
      initializedRef.current = true;
    } else {
      group.position.lerp(targetPositionRef.current, 1 - Math.exp(-15 * delta));
    }

    // Smooth rotation (handle angle wrapping)
    const targetYaw = rotation[1];
    let deltaAngle = targetYaw - group.rotation.y;
    deltaAngle = ((deltaAngle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    group.rotation.y += deltaAngle * (1 - Math.exp(-15 * delta));
    group.visible = !isCaught;

    // Subtle body tilt when moving
    body.rotation.z = isMoving ? Math.sin(t * 8) * 0.03 : 0;
    body.rotation.x = isMoving ? -0.06 : 0;

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
    body.traverse((child: THREE.Object3D) => {
      // Use .isMesh instead of instanceof
      if (!(child as THREE.Mesh).isMesh) {
        return;
      }

      const mesh = child as THREE.Mesh;
      const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
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

      <Text position={[0, (TARGET_HEIGHTS[species.name] ?? 1.0) + 0.3, 0]} fontSize={0.22} color="#FFFFFF" outlineColor="#1D3557" outlineWidth={0.04}>
        {name}
      </Text>
    </group>
  );
}

useGLTF.preload('/models/bulbasaur.glb?v=2');
useGLTF.preload('/models/ivysaur.glb?v=2');
useGLTF.preload('/models/venusaur.glb?v=2');
useGLTF.preload('/models/charmander.glb?v=2');
useGLTF.preload('/models/charmeleon.glb?v=2');
useGLTF.preload('/models/charizard.glb?v=2');
useGLTF.preload('/models/squirtle.glb?v=2');
useGLTF.preload('/models/wartortle.glb?v=2');
useGLTF.preload('/models/blastoise.glb?v=2');
