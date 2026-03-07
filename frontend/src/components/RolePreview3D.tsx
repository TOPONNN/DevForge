import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { ANIMATION_MAP } from './PokemonCharacter';

interface RolePreview3DProps {
  role: 'trainer' | 'pokemon';
  speciesName?: string;
}

function normalizeAndCloneScene(scene: THREE.Group, targetHeight: number) {
  const cloned = SkeletonUtils.clone(scene);

  cloned.traverse((child: THREE.Object3D) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.geometry = mesh.geometry.clone();

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((mat) => mat.clone());
      } else if (mesh.material) {
        mesh.material = mesh.material.clone();
      }
    }

    if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
      (child as THREE.SkinnedMesh).frustumCulled = false;
    }
  });

  cloned.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(cloned, true);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  const height = size.y > 0.001 ? size.y : 1;
  const scale = targetHeight / height;

  return {
    clonedScene: cloned,
    center,
    minY: bounds.min.y,
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
  };
}

function PreviewModel({ role, speciesName }: RolePreview3DProps) {
  const modelPath = role === 'trainer'
    ? '/models/ash_ketchum.glb'
    : `/models/${(speciesName ?? 'bulbasaur').toLowerCase()}.glb?v=2`;

  const { scene, animations } = useGLTF(modelPath);
  const targetHeight = role === 'trainer' ? 1.95 : 1.65;
  const rootRef = useRef<THREE.Group>(null);

  const { clonedScene, center, minY, scale } = useMemo(
    () => normalizeAndCloneScene(scene, targetHeight),
    [scene, targetHeight],
  );

  const mixer = useMemo(() => new THREE.AnimationMixer(clonedScene), [clonedScene]);

  const idleClipName = useMemo(() => {
    if (role === 'trainer') {
      const trainerIdleCandidates = ['Talking', 'Singing', 'House'];
      return trainerIdleCandidates.find((clip) => animations.some((anim) => anim.name === clip));
    }

    if (!speciesName) {
      return undefined;
    }

    const mappedIdle = ANIMATION_MAP[speciesName]?.idle;
    if (mappedIdle && animations.some((anim) => anim.name === mappedIdle)) {
      return mappedIdle;
    }

    return animations[0]?.name;
  }, [animations, role, speciesName]);

  useEffect(() => {
    if (!idleClipName) {
      return;
    }

    const clip = animations.find((anim) => anim.name === idleClipName);
    if (!clip) {
      return;
    }

    const action = mixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.fadeIn(0.25).play();

    return () => {
      action.fadeOut(0.2);
      action.stop();
    };
  }, [animations, idleClipName, mixer]);

  useFrame((_, delta) => {
    mixer.update(delta);
    if (rootRef.current) {
      rootRef.current.rotation.y += delta * 0.15;
    }
  });

  useEffect(() => {
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      clonedScene.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh) {
          return;
        }
        const mesh = child as THREE.Mesh;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          mat.dispose();
        }
      });
    };
  }, [clonedScene, mixer]);

  return (
    <group ref={rootRef}>
      <group scale={scale}>
        <primitive object={clonedScene} position={[-center.x, -minY, -center.z]} />
      </group>
    </group>
  );
}

function PreviewLoading() {
  return (
    <Html center>
      <div className="role-preview-loading">Loading...</div>
    </Html>
  );
}

export default function RolePreview3D({ role, speciesName }: RolePreview3DProps) {
  return (
    <div className="role-preview-3d" aria-label="3d-role-preview">
      <Canvas
        camera={{ position: [0, 1.35, 4.6], fov: 36 }}
        gl={{ antialias: true, alpha: true }}
      >
        <hemisphereLight args={['#ffffff', '#d3e4ff', 1.05]} position={[0, 5, 0]} />
        <directionalLight position={[3.5, 5.5, 2.2]} intensity={1.8} color="#ffffff" />
        <directionalLight position={[-2.5, 3.2, -2.8]} intensity={0.8} color="#9fc2ff" />

        <Suspense fallback={<PreviewLoading />}>
          <PreviewModel role={role} speciesName={speciesName} />
        </Suspense>

        <OrbitControls
          autoRotate
          autoRotateSpeed={0.8}
          enableZoom={false}
          enablePan={false}
          enableRotate
          minPolarAngle={Math.PI * 0.3}
          maxPolarAngle={Math.PI * 0.7}
          target={[0, 1.05, 0]}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload('/models/ash_ketchum.glb');
useGLTF.preload('/models/bulbasaur.glb?v=2');
useGLTF.preload('/models/ivysaur.glb?v=2');
useGLTF.preload('/models/venusaur.glb?v=2');
useGLTF.preload('/models/charmander.glb?v=2');
useGLTF.preload('/models/charmeleon.glb?v=2');
useGLTF.preload('/models/charizard.glb?v=2');
useGLTF.preload('/models/squirtle.glb?v=2');
useGLTF.preload('/models/wartortle.glb?v=2');
useGLTF.preload('/models/blastoise.glb?v=2');
