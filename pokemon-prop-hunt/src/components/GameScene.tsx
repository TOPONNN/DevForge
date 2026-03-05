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
    scene.fog = new THREE.Fog('#C8DFB0', 150, 700);
    return () => {
      scene.fog = null;
    };
  }, [scene]);

  return null;
}

// Track previous positions to detect movement for remote players
function useIsMoving(position: [number, number, number]): boolean {
  const prevPosRef = useRef<[number, number, number]>([...position]);
  const isMovingRef = useRef(false);
  const stillFramesRef = useRef(0);

  const dx = position[0] - prevPosRef.current[0];
  const dz = position[2] - prevPosRef.current[2];
  const distSq = dx * dx + dz * dz;

  const movingNow = distSq > 0.01 * 0.01;
  if (movingNow) {
    stillFramesRef.current = 0;
    isMovingRef.current = true;
  } else if (isMovingRef.current) {
    stillFramesRef.current += 1;
    if (stillFramesRef.current >= 3) {
      isMovingRef.current = false;
    }
  }

  prevPosRef.current = [...position];

  return isMovingRef.current;
}

function RemotePlayerPokemon({ player }: { player: { id: string; name: string; species: any; position: [number, number, number]; rotation: [number, number, number]; isCaught: boolean } }) {
  const isMoving = useIsMoving(player.position);

  return (
    <PokemonCharacter
      key={player.id}
      id={player.id}
      name={player.name}
      species={player.species}
      position={player.position}
      rotation={player.rotation}
      isMoving={isMoving && !player.isCaught}
      escaping={false}
      invulnerable={false}
      isCaught={player.isCaught}
    />
  );
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
            return <RemotePlayerPokemon key={player.id} player={player as any} />;
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
  const isDisoriented = useGameStore((state) => state.isDisoriented);
  const sunRef = useRef<THREE.Mesh>(null!);

  if (phase === 'lobby' || phase === 'selecting') {
    return null;
  }

  return (
    <div className={`game-canvas-shell ${isDisoriented ? 'disoriented' : ''}`}>
      <Canvas
        shadows
        dpr={[1, 2]}
        frameloop="always"
        camera={{ fov: 75, near: 0.1, far: 2000, position: [0, 1.6, 12] }}
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

        <mesh ref={sunRef} position={[200, 300, 150]}>
          <sphereGeometry args={[20, 32, 32]} />
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
    </div>
  );
}
