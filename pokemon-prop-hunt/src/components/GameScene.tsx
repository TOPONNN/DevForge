import { AdaptiveDpr, AdaptiveEvents, Stats } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, GodRays } from '@react-three/postprocessing';
import { Physics } from '@react-three/rapier';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useKeyboard } from '../hooks/useKeyboard';
import { useGameStore } from '../stores/gameStore';
import { useNetworkStore } from '../stores/networkStore';
import CatchAnimation from './CatchAnimation';
import GameMap from './GameMap';
import Player from './Player';
import PokeballSystem from './PokeballSystem';
import PokemonCharacter from './PokemonCharacter';

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
    scene.fog = new THREE.Fog('#C8DFB0', 50, 220);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  return null;
}

function RemotePlayers() {
  const playerId = useNetworkStore((state) => state.playerId);
  const players = useNetworkStore((state) => state.players);

  return (
    <group>
      {[...players.values()]
        .filter((player) => player.id !== playerId)
        .map((player) => {
          if (player.role === 'pokemon' && player.species) {
            return (
              <PokemonCharacter
                key={player.id}
                id={player.id}
                name={player.name}
                species={player.species}
                position={player.position}
                rotation={player.rotation}
                isMoving={!player.isCaught}
                escaping={false}
                invulnerable={false}
                isCaught={player.isCaught}
              />
            );
          }
          return (
            <mesh key={player.id} position={player.position} castShadow>
              <capsuleGeometry args={[0.35, 0.9, 8, 12]} />
              <meshStandardMaterial color="#1D3557" roughness={0.38} metalness={0.1} />
            </mesh>
          );
        })}
    </group>
  );
}

export default function GameScene({ keysRef, pointerLocked }: GameSceneProps) {
  const showFps = false;
  const phase = useGameStore((state) => state.phase);
  const sunRef = useRef<THREE.Mesh>(null!);

  if (phase === 'lobby' || phase === 'selecting') {
    return null;
  }

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop="always"
      camera={{ fov: 75, near: 0.1, far: 500, position: [0, 1.6, 12] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#B5D8F0']} />
      <CameraSetup />

      <Physics gravity={[0, -20, 0]} interpolate>
        <GameMap />
        <Player keysRef={keysRef} pointerLocked={pointerLocked} />
        <RemotePlayers />
        <PokeballSystem pointerLocked={pointerLocked} />
      </Physics>

      <mesh ref={sunRef} position={[40, 50, 25]}>
        <sphereGeometry args={[8, 32, 32]} />
        <meshBasicMaterial color="#FFD080" />
      </mesh>

      <CatchAnimation />
      <EffectComposer>
        <GodRays sun={sunRef} samples={60} density={0.96} decay={0.9} weight={0.4} exposure={0.6} clampMax={1} />
        <Bloom luminanceThreshold={0.7} luminanceSmoothing={0.4} intensity={0.6} mipmapBlur />
      </EffectComposer>
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
      {showFps ? <Stats className="fps-counter" showPanel={0} /> : null}
    </Canvas>
  );
}
