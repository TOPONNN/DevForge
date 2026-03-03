import { Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../stores/gameStore';
import { useNetworkStore } from '../stores/networkStore';
import { soundManager } from '../systems/sound';
import type { ActivePokeball, ThrowData, Vector3Tuple } from '../types/game';

function ProceduralPokeballMesh() {
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[0.2, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#E63946" roughness={0.28} metalness={0.14} />
      </mesh>
      <mesh castShadow>
        <sphereGeometry args={[0.2, 20, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial color="#F8F9FA" roughness={0.22} metalness={0.08} />
      </mesh>
      <mesh>
        <torusGeometry args={[0.2, 0.015, 8, 24]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[0, 0, 0.2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[0, 0, 0.208]}>
        <cylinderGeometry args={[0.03, 0.03, 0.022, 16]} />
        <meshStandardMaterial color="#F8F9FA" />
      </mesh>
    </group>
  );
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
    if (position.y < 0.1 && !hasGroundHitRef.current) {
      hasGroundHitRef.current = true;
      soundManager.play('pokeball_bounce');
      setPokeballState(ball.id, 'broken');
      window.setTimeout(() => removePokeball(ball.id), 2000);
    }
  });

  return (
    <RigidBody
      ref={bodyRef}
      position={ball.position}
      colliders={false}
      linearVelocity={ball.velocity}
      mass={0.22}
      restitution={0.35}
      friction={0.9}
      enabledRotations={[true, true, true]}
      gravityScale={1}
    >
      <BallCollider args={[0.2]} />
      <ProceduralPokeballMesh />
    </RigidBody>
  );
}

export default function PokeballSystem({ pointerLocked }: { pointerLocked: boolean }) {
  const { camera } = useThree();

  const role = useGameStore((state) => state.role);
  const phase = useGameStore((state) => state.phase);
  const throwPower = useGameStore((state) => state.throwPower);
  const isCharging = useGameStore((state) => state.isCharging);
  const activePokeballs = useGameStore((state) => state.activePokeballs);
  const startCharge = useGameStore((state) => state.startCharge);
  const setChargePower = useGameStore((state) => state.setChargePower);
  const releaseThrow = useGameStore((state) => state.releaseThrow);
  const setPokeballState = useGameStore((state) => state.setPokeballState);

  const playerId = useNetworkStore((state) => state.playerId);
  const players = useNetworkStore((state) => state.players);
  const sendThrow = useNetworkStore((state) => state.sendThrow);
  const sendCatchAttempt = useNetworkStore((state) => state.sendCatchAttempt);

  const chargingSinceRef = useRef(0);
  const attemptedBallsRef = useRef<Set<string>>(new Set());
  const arcPoints = useMemo(() => {
    if (!isCharging || role !== 'trainer' || !pointerLocked) {
      return [];
    }
    const origin = camera.position.clone();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const upBoost = 0.25 + throwPower * 0.35;
    direction.y += upBoost;
    direction.normalize();

    const speed = 7 + throwPower * 18;
    const points: Vector3Tuple[] = [];
    for (let i = 0; i < 28; i += 1) {
      const t = i * 0.08;
      points.push([
        origin.x + direction.x * speed * t,
        origin.y + direction.y * speed * t - 4.9 * t * t,
        origin.z + direction.z * speed * t,
      ]);
    }
    return points;
  }, [camera, isCharging, pointerLocked, role, throwPower]);

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
      direction.y += 0.25 + throwPower * 0.35;
      direction.normalize();

      const throwData: ThrowData = {
        origin: [camera.position.x, camera.position.y - 0.1, camera.position.z],
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
  }, [camera, phase, playerId, pointerLocked, releaseThrow, role, sendThrow, startCharge, throwPower]);

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
          setPokeballState(ball.id, 'wiggling');
          sendCatchAttempt({
            origin: ball.position,
            direction: ball.velocity,
            power: throwPower,
            pokemonTarget: remotePlayer.id,
          });
          window.setTimeout(() => {
            useGameStore.getState().removePokeball(ball.id);
            attemptedBallsRef.current.delete(ball.id);
          }, 1400);
          break;
        }
      }
    }
  });

  return (
    <>
      {arcPoints.length > 1 ? <Line points={arcPoints} color="#FFD60A" lineWidth={1.5} transparent opacity={0.8} /> : null}
      {activePokeballs.map((ball) => (
        <PokeballProjectile key={ball.id} ball={ball} />
      ))}
    </>
  );
}
