import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useGameStore } from '../stores/gameStore';
import { useNetworkStore } from '../stores/networkStore';
import { soundManager } from '../systems/sound';
import type { ActivePokeball, ThrowData } from '../types/game';

function PokeballGLBMesh() {
  const { scene } = useGLTF('/models/pokeball_throw.glb');
  const cloned = useMemo(() => {
    const c = cloneSkeleton(scene) as THREE.Object3D;
    const pokeballRoot = c.getObjectByName('Pokeball');
    if (pokeballRoot) {
      pokeballRoot.position.set(0, 0, 0);
    }
    c.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
      }
    });
    return c;
  }, [scene]);

  return <primitive object={cloned} scale={[0.12, 0.12, 0.12]} />;
}

function PokeballProjectile({ ball }: { ball: ActivePokeball }) {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const removePokeball = useGameStore((state) => state.removePokeball);
  const setPokeballState = useGameStore((state) => state.setPokeballState);
  const updatePokeballPosition = useGameStore((state) => state.updatePokeballPosition);
  const hasGroundHitRef = useRef(false);

  useFrame(() => {
    const body = bodyRef.current;
    if (!body || ball.state !== 'flying') {
      return;
    }
    const position = body.translation();
    const velocity = body.linvel();
    updatePokeballPosition(
      ball.id,
      [position.x, position.y, position.z],
      [velocity.x, velocity.y, velocity.z],
    );
    if (position.y < 0.35 && !hasGroundHitRef.current) {
      hasGroundHitRef.current = true;
      soundManager.play('pokeball_bounce');
      setPokeballState(ball.id, 'broken');

      body.setTranslation({ x: position.x, y: 0.2, z: position.z }, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setLinearDamping(50);
      body.setAngularDamping(50);

      window.setTimeout(() => removePokeball(ball.id), 2000);
    }

    if (position.y < -5) {
      removePokeball(ball.id);
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={ball.position}
      colliders={false}
      linearVelocity={ball.velocity}
      mass={0.22}
      restitution={0.25}
      friction={0.6}
      enabledRotations={[true, true, true]}
      gravityScale={1}
      linearDamping={0.5}
      angularDamping={2.0}
    >
      <BallCollider args={[0.2]} />
      <PokeballGLBMesh />
    </RigidBody>
  );
}

export default function PokeballSystem({ pointerLocked }: { pointerLocked: boolean }) {
  const { camera } = useThree();

  const role = useGameStore((state) => state.role);
  const phase = useGameStore((state) => state.phase);
  const cameraMode = useGameStore((state) => state.cameraMode);
  const localPosition = useGameStore((state) => state.localPosition);
  const throwPower = useGameStore((state) => state.throwPower);
  const isCharging = useGameStore((state) => state.isCharging);
  const activePokeballs = useGameStore((state) => state.activePokeballs);
  const startCharge = useGameStore((state) => state.startCharge);
  const setChargePower = useGameStore((state) => state.setChargePower);
  const releaseThrow = useGameStore((state) => state.releaseThrow);
  const setPokeballState = useGameStore((state) => state.setPokeballState);
  const startCatchAnim = useGameStore((state) => state.startCatchAnim);
  const removePokeball = useGameStore((state) => state.removePokeball);

  const playerId = useNetworkStore((state) => state.playerId);
  const players = useNetworkStore((state) => state.players);
  const sendThrow = useNetworkStore((state) => state.sendThrow);
  const sendCatchAttempt = useNetworkStore((state) => state.sendCatchAttempt);

  const chargingSinceRef = useRef(0);
  const attemptedBallsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || !pointerLocked || role !== 'trainer' || phase !== 'hunting') {
        return;
      }
      chargingSinceRef.current = performance.now();
      startCharge();
    };

    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== 0 || role !== 'trainer' || phase !== 'hunting') {
        return;
      }
      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      direction.y += 0.05;
      direction.normalize();

      let origin: [number, number, number];
      if (cameraMode === 'third-person') {
        origin = [localPosition[0], localPosition[1] + 1.3, localPosition[2]];

        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);
        const farPoint = new THREE.Vector3().copy(camera.position).addScaledVector(cameraDir, 100);
        const throwDir = new THREE.Vector3(
          farPoint.x - origin[0],
          farPoint.y - origin[1],
          farPoint.z - origin[2],
        ).normalize();
        throwDir.y = Math.max(throwDir.y, 0.03);
        throwDir.normalize();

        direction.copy(throwDir);
      } else {
        origin = [camera.position.x, camera.position.y - 0.1, camera.position.z];
      }

      const throwData: ThrowData = {
        origin,
        direction: [direction.x, direction.y, direction.z],
        power: throwPower,
      };
      const created = releaseThrow(throwData, playerId || 'local-trainer');
      if (created) {
        soundManager.play('pokeball_throw');
        sendThrow(throwData);
      }
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [
    camera,
    cameraMode,
    localPosition,
    phase,
    playerId,
    pointerLocked,
    releaseThrow,
    role,
    sendThrow,
    startCharge,
    throwPower,
  ]);

  useFrame(() => {
    if (isCharging) {
      const elapsed = (performance.now() - chargingSinceRef.current) / 1500;
      setChargePower(elapsed);
    }

    if (role !== 'trainer') {
      return;
    }

    for (const ball of activePokeballs) {
      if (ball.state !== 'flying' || attemptedBallsRef.current.has(ball.id)) {
        continue;
      }
      for (const remotePlayer of players.values()) {
        if (remotePlayer.id === playerId || remotePlayer.role !== 'pokemon' || remotePlayer.isCaught) {
          continue;
        }
        const dx = ball.position[0] - remotePlayer.position[0];
        const dy = ball.position[1] - remotePlayer.position[1];
        const dz = ball.position[2] - remotePlayer.position[2];
        const hitRadius = remotePlayer.species?.size === 'large' ? 1.35 : remotePlayer.species?.size === 'small' ? 0.8 : 1;
        if (dx * dx + dy * dy + dz * dz <= hitRadius * hitRadius) {
          attemptedBallsRef.current.add(ball.id);
          soundManager.play('catch_wiggle');
          // Start 3D catch animation & remove original ball
          startCatchAnim(ball.position, remotePlayer.position, remotePlayer.id);
          setPokeballState(ball.id, 'wiggling');
          removePokeball(ball.id);
          sendCatchAttempt({
            origin: ball.position,
            direction: ball.velocity,
            power: throwPower,
            pokemonTarget: remotePlayer.id,
          });
          window.setTimeout(() => {
            attemptedBallsRef.current.delete(ball.id);
          }, 5000);
          break;
        }
      }
    }
  });

  return (
    <>
      {activePokeballs.map((ball) => (
        <PokeballProjectile key={ball.id} ball={ball} />
      ))}
    </>
  );
}

useGLTF.preload('/models/pokeball_throw.glb');
