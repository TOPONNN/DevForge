import { AdaptiveDpr, AdaptiveEvents, Stats, Text, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Physics } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useKeyboard } from '../hooks/useKeyboard';
import { useAppSelector } from '../stores/hooks';
import type { PokemonSpecies, RemotePlayer } from '../types/game';
import CatchAnimation from './CatchAnimation';
import GameMap from './GameMap';
import Player from './Player';
import PokeballSystem from './PokeballSystem';
import PokemonCharacter, { getGroundOffset } from './PokemonCharacter';
import CatchAnimation3D from './CatchAnimation3D';

interface GameSceneProps {
  keysRef: ReturnType<typeof useKeyboard>;
  pointerLocked: boolean;
}

function CameraSetup() {
  const { camera, scene } = useThree();

  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 75;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  useEffect(() => {
    scene.fog = new THREE.Fog('#C8DFB0', 150, 700);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  return null;
}

function WebGLGuard() {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;

    const onLost = (e: Event) => {
      e.preventDefault();
      console.warn('[WebGL] Context lost — will attempt restore, auto-reload in 5s');
      // If context doesn't restore within 5 seconds, force reload
      reloadTimer = setTimeout(() => {
        console.warn('[WebGL] Context not restored after 5s — reloading page');
        window.location.reload();
      }, 5000);
    };
    const onRestored = () => {
      if (reloadTimer) {
        clearTimeout(reloadTimer);
        reloadTimer = null;
      }
      // Re-initialize renderer state after context restore
      gl.clear(true, true, true);
      gl.setSize(canvas.clientWidth, canvas.clientHeight);
      gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  }, [gl]);

  return null;
}

// Track previous positions to detect movement for remote players (time-based hysteresis)
function useIsMoving(position: [number, number, number]): boolean {
  const prevPosRef = useRef<[number, number, number]>([...position]);
  const isMovingRef = useRef(false);
  const lastMoveTimeRef = useRef(0);

  const dx = position[0] - prevPosRef.current[0];
  const dz = position[2] - prevPosRef.current[2];
  const distSq = dx * dx + dz * dz;

  const now = performance.now();
  if (distSq > 0.0001) {
    lastMoveTimeRef.current = now;
    isMovingRef.current = true;
  } else if (isMovingRef.current && now - lastMoveTimeRef.current > 250) {
    isMovingRef.current = false;
  }

  prevPosRef.current = [...position];
  return isMovingRef.current;
}

function RemotePlayerPokemon({
  player,
}: {
  player: {
    id: string;
    name: string;
    species: PokemonSpecies;
    position: [number, number, number];
    rotation: [number, number, number];
    isCaught: boolean;
  };
}) {
  const isMoving = useIsMoving(player.position);

  return (
    <PokemonCharacter
      key={player.id}
      id={player.id}
      name={player.name}
      species={player.species}
      position={[player.position[0], player.position[1] + getGroundOffset(player.species.name), player.position[2]]}
      rotation={player.rotation}
      isMoving={isMoving && !player.isCaught}
      escaping={false}
      invulnerable={false}
      isCaught={player.isCaught}
    />
  );
}

function RemoteTrainer({ player }: { player: RemotePlayer }) {
  const isMoving = useIsMoving(player.position);
  const activePokeballs = useAppSelector((state) => state.game.activePokeballs);
  const { scene, animations } = useGLTF('/models/ash_ketchum.glb');

  const { clonedScene, normalizedScale, minY, center, clipsByName } = useMemo(() => {
    const cloned = cloneSkeleton(scene) as THREE.Object3D;
    const sketchfabRoot = cloned.getObjectByName('Sketchfab_model');
    if (sketchfabRoot) {
      // Keep the original -90° X rotation (converts Z-up Blender geometry to Y-up Three.js)
      // Only reset position to center the model
      sketchfabRoot.position.set(0, 0, 0);
    }
    const boneNames = new Set<string>();

    cloned.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Bone).isBone) {
        boneNames.add(child.name);
      }
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
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
    const bounds = new THREE.Box3().setFromObject(cloned, false);
    const size = new THREE.Vector3();
    const ctr = new THREE.Vector3();
    bounds.getSize(size);
    bounds.getCenter(ctr);
    const scale = 1.0;

    const clipMap: Record<string, THREE.AnimationClip> = {};
    for (const clip of animations) {
      if (clip.name === 'Sketchfab_modelAction') {
        continue;
      }
      const stripped = clip.clone();
      stripped.tracks = stripped.tracks.filter((track) => {
        const dotIdx = track.name.lastIndexOf('.');
        const nodeName = dotIdx >= 0 ? track.name.slice(0, dotIdx) : track.name;
        if (nodeName === 'Sketchfab_model') return false;
        if (track.name.endsWith('.position') && !boneNames.has(nodeName)) {
          return false;
        }
        return true;
      });
      clipMap[stripped.name] = stripped;
    }
    return {
      clonedScene: cloned,
      normalizedScale: scale,
      minY: bounds.isEmpty() ? 0 : bounds.min.y,
      center: ctr,
      clipsByName: clipMap,
    };
  }, [scene, animations]);

  const mixer = useMemo(() => new THREE.AnimationMixer(clonedScene), [clonedScene]);
  const walkActionRef = useRef<THREE.AnimationAction | null>(null);
  const idleActionRef = useRef<THREE.AnimationAction | null>(null);
  const throwActionRef = useRef<THREE.AnimationAction | null>(null);
  const throwingUntilRef = useRef(0);
  const isThrowingRef = useRef(false);
  const prevBallIdsRef = useRef<Set<string>>(new Set());
  const animReadyRef = useRef(false);
  const outerGroupRef = useRef<THREE.Group>(null);

  const applyLocomotion = (moving: boolean) => {
    const walkAction = walkActionRef.current;
    const idleAction = idleActionRef.current;
    if (moving) {
      if (idleAction) idleAction.fadeOut(0.3);
      if (walkAction) {
        walkAction.enabled = true;
        walkAction.setLoop(THREE.LoopRepeat, Infinity);
        walkAction.clampWhenFinished = false;
        walkAction.fadeIn(0.3).play();
      }
      return;
    }
    if (walkAction) walkAction.fadeOut(0.3);
    if (idleAction) {
      idleAction.enabled = true;
      idleAction.setLoop(THREE.LoopRepeat, Infinity);
      idleAction.clampWhenFinished = false;
      idleAction.fadeIn(0.3).play();
    }
  };

  useEffect(() => {
    const walkingClip = clipsByName.WalkAnim ?? clipsByName.Walking;
    const idleClip = clipsByName.Talking ?? clipsByName.Singing ?? clipsByName.House;
    const throwClip = clipsByName.ThrowAnim ?? clipsByName['ThrowAnim_v4.001'] ?? clipsByName.Fight;
    walkActionRef.current = walkingClip ? mixer.clipAction(walkingClip) : null;
    idleActionRef.current = idleClip ? mixer.clipAction(idleClip) : null;
    throwActionRef.current = throwClip ? mixer.clipAction(throwClip) : null;

    if (walkActionRef.current) {
      walkActionRef.current.enabled = true;
    }
    // Start idle immediately with full weight — no fadeIn to prevent bind-pose flash
    if (idleActionRef.current) {
      idleActionRef.current.enabled = true;
      idleActionRef.current.setLoop(THREE.LoopRepeat, Infinity);
      idleActionRef.current.play();
    }
    mixer.update(0);
    animReadyRef.current = true;
    return () => {
      animReadyRef.current = false;
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
          if (mat && typeof mat.dispose === 'function') {
            mat.dispose();
          }
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clonedScene, clipsByName, mixer]);

  useEffect(() => {
    if (isThrowingRef.current) {
      return;
    }
    applyLocomotion(isMoving);
  }, [isMoving]);

  useEffect(() => {
    const previous = prevBallIdsRef.current;
    const next = new Set<string>();
    let shouldThrow = false;

    for (const ball of activePokeballs) {
      next.add(ball.id);
      if (previous.has(ball.id)) {
        continue;
      }

      const dx = ball.position[0] - player.position[0];
      const dz = ball.position[2] - player.position[2];
      const distanceSq = dx * dx + dz * dz;
      const ownedByTrainer = ball.ownerId === player.id;
      if (ownedByTrainer || distanceSq < 4) {
        shouldThrow = true;
      }
    }

    prevBallIdsRef.current = next;

    if (!shouldThrow) {
      return;
    }

    const throwAction = throwActionRef.current;
    const walkAction = walkActionRef.current;
    const idleAction = idleActionRef.current;
    if (!throwAction) {
      return;
    }

    throwingUntilRef.current = performance.now() + 2000;
    isThrowingRef.current = true;
    if (walkAction) {
      walkAction.fadeOut(0.12);
    }
    if (idleAction) {
      idleAction.fadeOut(0.12);
    }
    throwAction.enabled = true;
    throwAction.setLoop(THREE.LoopOnce, 1);
    throwAction.clampWhenFinished = true;
    throwAction.time = 0;
    throwAction.fadeIn(0.12).play();
  }, [activePokeballs, player.id, player.position]);

  useFrame((_, delta) => {
    mixer.update(delta);
    // Show model only after animation is ready (prevents bind-pose face-down flash)
    if (outerGroupRef.current && animReadyRef.current && !outerGroupRef.current.visible) {
      outerGroupRef.current.visible = true;
    }

    if (!isThrowingRef.current) {
      return;
    }
    if (performance.now() < throwingUntilRef.current) {
      return;
    }

    const throwAction = throwActionRef.current;
    if (throwAction) {
      throwAction.fadeOut(0.12);
      throwAction.stop();
    }
    isThrowingRef.current = false;
    applyLocomotion(isMoving);
  });

  return (
    <group ref={outerGroupRef} visible={false} position={player.position} rotation={[0, player.rotation[1], 0]}>
      <group position={[0, -(0.45 + 0.35), 0]}>
        <group scale={normalizedScale} rotation={[0, Math.PI, 0]}>
          <primitive object={clonedScene} position={[-center.x, -minY, -center.z]} />
        </group>
      </group>
      <Text position={[0, 1.9, 0]} fontSize={0.22} color="#FFFFFF" outlineColor="#1D3557" outlineWidth={0.04}>
        {player.name}
      </Text>
    </group>
  );
}

function RemotePlayers() {
  const playerId = useAppSelector((state) => state.network.playerId);
  const players = useAppSelector((state) => state.network.players);

  return (
    <group>
      {Object.values(players)
        .filter((player) => player.id !== playerId)
        .map((player) => {
          if (player.role === 'pokemon' && player.species) {
            return (
              <RemotePlayerPokemon
                key={player.id}
                player={{
                  id: player.id,
                  name: player.name,
                  species: player.species,
                  position: player.position,
                  rotation: player.rotation,
                  isCaught: player.isCaught,
                }}
              />
            );
          }
          return <RemoteTrainer key={player.id} player={player} />;
        })}
    </group>
  );
}

export default function GameScene({ keysRef, pointerLocked }: GameSceneProps) {
  const showFps = false;
  const phase = useAppSelector((state) => state.game.phase);
  const isDisoriented = useAppSelector((state) => state.game.isDisoriented);

  if (phase === 'lobby' || phase === 'selecting') {
    return null;
  }

  return (
    <div className={`game-canvas-shell ${isDisoriented ? 'disoriented' : ''}`}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop="always"
        camera={{ fov: 75, near: 0.1, far: 2000, position: [0, 1.6, 12] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#B5D8F0']} />
        <CameraSetup />
        <WebGLGuard />

        <Physics gravity={[0, -20, 0]} interpolate>
          <GameMap />
          <Player keysRef={keysRef} pointerLocked={pointerLocked} />
          <RemotePlayers />
          <PokeballSystem pointerLocked={pointerLocked} />
        </Physics>

        <CatchAnimation3D />

        <CatchAnimation />
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.4} intensity={0.3} mipmapBlur />
        </EffectComposer>
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        {showFps ? <Stats className="fps-counter" showPanel={0} /> : null}
      </Canvas>
    </div>
  );
}

useGLTF.preload('/models/ash_ketchum.glb');
