import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gameActions, releaseThrow, setChargePower, startCharge } from '../stores/gameSlice';
import { useAppDispatch, useAppSelector } from '../stores/hooks';
import { sendCatchAttempt, sendThrow } from '../stores/networkSlice';
import { soundManager } from '../systems/sound';
import type { ActivePokeball, ThrowData } from '../types/game';

function PokeballGLBMesh() {
  const { scene } = useGLTF('/models/pokeball_throw.glb');
  const cloned = useMemo(() => {
    const c = cloneSkeleton(scene) as THREE.Object3D;
    const pokeballRoot = c.getObjectByName('Pokeball');
    if (pokeballRoot) {
      pokeballRoot.position.set(0, 0, 0);
      pokeballRoot.scale.set(1, 1, 1);
    }
    c.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
      }
    });
    return c;
  }, [scene]);

  return <primitive object={cloned} scale={[3.5, 3.5, 3.5]} />;
}

function PokeballProjectile({ ball }: { ball: ActivePokeball }) {
  const dispatch = useAppDispatch();
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const hasGroundHitRef = useRef(false);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFrame(() => {
    const body = bodyRef.current;
    if (!body || ball.state !== 'flying') {
      return;
    }
    const position = body.translation();
    const velocity = body.linvel();
    dispatch(
      gameActions.updatePokeballPosition({
        id: ball.id,
        position: [position.x, position.y, position.z],
        velocity: [velocity.x, velocity.y, velocity.z],
      }),
    );

    // First ground contact — bounce + start rolling (stay 'flying' for catch detection)
    if (position.y < 0.35 && !hasGroundHitRef.current) {
      hasGroundHitRef.current = true;
      soundManager.play('pokeball_bounce');

      // Small bounce, keep horizontal momentum for rolling
      body.setTranslation({ x: position.x, y: 0.22, z: position.z }, true);
      const vx = velocity.x * 0.4;
      const vz = velocity.z * 0.4;
      body.setLinvel({ x: vx, y: Math.abs(velocity.y) * 0.12, z: vz }, true);

      // Gradual slowdown — ball rolls to a stop over ~2s
      body.setLinearDamping(3.0);
      body.setAngularDamping(3.0);

      // Remove after 3s if not caught
      removeTimerRef.current = window.setTimeout(() => dispatch(gameActions.removePokeball(ball.id)), 3000);
    }

    // Clamp Y so ball doesn't clip through ground while rolling
    if (hasGroundHitRef.current && position.y < 0.18) {
      body.setTranslation({ x: position.x, y: 0.2, z: position.z }, true);
      const vy = velocity.y;
      if (vy < -0.5) {
        body.setLinvel({ x: velocity.x, y: 0, z: velocity.z }, true);
      }
    }

    if (position.y < -5) {
      dispatch(gameActions.removePokeball(ball.id));
    }
  });

  // Cleanup timer on unmount (e.g. ball caught before rolling timeout)
  useEffect(() => {
    return () => {
      if (removeTimerRef.current) {
        clearTimeout(removeTimerRef.current);
      }
    };
  }, []);

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
  const dispatch = useAppDispatch();
  const { camera } = useThree();

  const role = useAppSelector((state) => state.game.role);
  const phase = useAppSelector((state) => state.game.phase);
  const cameraMode = useAppSelector((state) => state.game.cameraMode);
  const localPosition = useAppSelector((state) => state.game.localPosition);
  const throwPower = useAppSelector((state) => state.game.throwPower);
  const isCharging = useAppSelector((state) => state.game.isCharging);
  const activePokeballs = useAppSelector((state) => state.game.activePokeballs);

  const playerId = useAppSelector((state) => state.network.playerId);
  const players = useAppSelector((state) => state.network.players);

  const chargingSinceRef = useRef(0);
  const attemptedBallsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || !pointerLocked || role !== 'trainer' || phase !== 'hunting') {
        return;
      }
      chargingSinceRef.current = performance.now();
      dispatch(startCharge());
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
      const created = dispatch(releaseThrow(throwData, playerId || 'local-trainer'));
      if (created) {
        soundManager.play('pokeball_throw');
        dispatch(sendThrow(throwData));
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
    dispatch,
    role,
    throwPower,
  ]);

  useFrame(() => {
    if (isCharging) {
      const elapsed = (performance.now() - chargingSinceRef.current) / 1500;
      dispatch(setChargePower(elapsed));
    }

    if (role !== 'trainer') {
      return;
    }

    for (const ball of activePokeballs) {
      if (ball.state !== 'flying' || attemptedBallsRef.current.has(ball.id)) {
        continue;
      }
      for (const remotePlayer of Object.values(players)) {
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
          dispatch(
            gameActions.startCatchAnim({ ballPos: ball.position, pokemonPos: remotePlayer.position, pokemonId: remotePlayer.id }),
          );
          dispatch(gameActions.setPokeballState({ id: ball.id, state: 'wiggling' }));
          dispatch(gameActions.removePokeball(ball.id));
          dispatch(sendCatchAttempt({
            origin: ball.position,
            direction: ball.velocity,
            power: throwPower,
            pokemonTarget: remotePlayer.id,
          }));
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
