import { AdaptiveDpr, AdaptiveEvents, Stats } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
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
      console.log('[WebGL] Context restored');
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
