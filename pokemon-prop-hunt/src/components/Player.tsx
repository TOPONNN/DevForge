import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useKeyboard } from '../hooks/useKeyboard';
import { useGameStore } from '../stores/gameStore';
import { useNetworkStore } from '../stores/networkStore';
import { soundManager } from '../systems/sound';
import PokemonCharacter from './PokemonCharacter';

interface PlayerProps {
  keysRef: ReturnType<typeof useKeyboard>;
  pointerLocked: boolean;
}

const TRAINER_WALK_SPEED = 5;
const TRAINER_SPRINT_SPEED = 7.8;
const TRAINER_JUMP_IMPULSE = 5;
const EYE_HEIGHT = 1.6;

export default function Player({ keysRef, pointerLocked }: PlayerProps) {
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const { camera } = useThree();
  const { world, rapier } = useRapier();

  const role = useGameStore((state) => state.role);
  const isCaught = useGameStore((state) => state.isCaught);
  const selectedSpecies = useGameStore((state) => state.selectedSpecies);
  const escaping = useGameStore((state) => state.escaping);
  const dodgeCooldown = useGameStore((state) => state.dodgeCooldown);
  const dodge = useGameStore((state) => state.dodge);
  const setDodgeCooldown = useGameStore((state) => state.setDodgeCooldown);
  const setLocalTransform = useGameStore((state) => state.setLocalTransform);

  const sendPosition = useNetworkStore((state) => state.sendPosition);
  const playerId = useNetworkStore((state) => state.playerId);
  const playerName = useNetworkStore((state) => state.players.get(playerId)?.name ?? 'You');

  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const jumpHeldRef = useRef(false);
  const dodgeHeldRef = useRef(false);
  const groundedRef = useRef(false);
  const footstepTimerRef = useRef(0);
  const moveDirection = useMemo(() => new THREE.Vector3(), []);
  const cameraTargetPosition = useMemo(() => new THREE.Vector3(), []);
  const cameraLookAt = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!pointerLocked) {
        return;
      }
      yawRef.current -= event.movementX * 0.002;
      pitchRef.current -= event.movementY * 0.002;
      pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -1.35, 1.35);
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [pointerLocked]);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    if (dodgeCooldown > 0) {
      setDodgeCooldown(Math.max(0, dodgeCooldown - delta));
    }

    const keys = keysRef.current;
    const translation = body.translation();
    const ray = new rapier.Ray(
      { x: translation.x, y: translation.y, z: translation.z },
      { x: 0, y: -1, z: 0 },
    );
    groundedRef.current = world.castRay(ray, 1.1, true, undefined, undefined, undefined, body) !== null;

    const forwardInput = (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0);
    const strafeInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

    moveDirection.set(strafeInput, 0, forwardInput);
    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, yawRef.current);
    }

    if (role === 'trainer') {
      const speed = keys.sprint ? TRAINER_SPRINT_SPEED : TRAINER_WALK_SPEED;
      const currentVel = body.linvel();
      body.setLinvel(
        {
          x: pointerLocked ? moveDirection.x * speed : 0,
          y: currentVel.y,
          z: pointerLocked ? moveDirection.z * speed : 0,
        },
        true,
      );
      if (keys.jump && !jumpHeldRef.current && groundedRef.current && pointerLocked) {
        body.applyImpulse({ x: 0, y: TRAINER_JUMP_IMPULSE, z: 0 }, true);
      }
      jumpHeldRef.current = keys.jump;

      const lookQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ'));
      camera.quaternion.slerp(lookQuaternion, Math.min(1, delta * 22));
      cameraTargetPosition.set(translation.x, translation.y + EYE_HEIGHT, translation.z);
      camera.position.lerp(cameraTargetPosition, Math.min(1, delta * 18));
    } else {
      const speciesSpeed = selectedSpecies?.speed ?? 4.5;
      const boosted = escaping ? speciesSpeed * 1.55 : speciesSpeed;
      body.setLinvel(
        {
          x: pointerLocked && !isCaught ? moveDirection.x * boosted : 0,
          y: body.linvel().y,
          z: pointerLocked && !isCaught ? moveDirection.z * boosted : 0,
        },
        true,
      );

      if (keys.jump && !dodgeHeldRef.current && pointerLocked && !isCaught) {
        if (dodge()) {
          soundManager.play('pokemon_dodge');
          const dodgeDir = moveDirection.lengthSq() > 0 ? moveDirection.clone().multiplyScalar(12) : new THREE.Vector3(0, 0, -8);
          body.applyImpulse({ x: dodgeDir.x, y: 0.4, z: dodgeDir.z }, true);
        }
      }
      dodgeHeldRef.current = keys.jump;

      cameraLookAt.set(translation.x, translation.y + 0.8, translation.z);
      const dist = 4.1;
      const height = 1.9;
      cameraTargetPosition.set(
        cameraLookAt.x + Math.sin(yawRef.current) * dist,
        cameraLookAt.y + height + Math.sin(pitchRef.current) * 0.6,
        cameraLookAt.z + Math.cos(yawRef.current) * dist,
      );
      camera.position.lerp(cameraTargetPosition, Math.min(1, delta * 8));
      camera.lookAt(cameraLookAt);
    }

    const isMovingNow = moveDirection.lengthSq() > 0 && pointerLocked && (!isCaught || role === 'trainer');
    if (isMovingNow && groundedRef.current) {
      footstepTimerRef.current += delta;
      const stepInterval = keys.sprint ? 0.28 : 0.38;
      if (footstepTimerRef.current >= stepInterval) {
        soundManager.play('footsteps');
        footstepTimerRef.current = 0;
      }
    } else {
      footstepTimerRef.current = 0;
    }

    setLocalTransform(
      [translation.x, translation.y, translation.z],
      [pitchRef.current, yawRef.current, 0],
    );
    sendPosition(
      [translation.x, translation.y, translation.z],
      [pitchRef.current, yawRef.current, 0],
    );
  });

  const pokemonMoving =
    keysRef.current.forward || keysRef.current.backward || keysRef.current.left || keysRef.current.right;

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      enabledRotations={[false, false, false]}
      position={[0, 1.1, 12]}
      mass={1}
      friction={0}
      linearDamping={8}
      canSleep={false}
    >
      <CapsuleCollider args={[0.45, 0.35]} />
      {role === 'pokemon' && selectedSpecies ? (
        <PokemonCharacter
          id={playerId || 'local'}
          name={playerName}
          species={selectedSpecies}
          position={[0, -0.2, 0]}
          rotation={[0, yawRef.current, 0]}
          isMoving={pokemonMoving}
          escaping={escaping}
          invulnerable={escaping}
          isCaught={isCaught}
        />
      ) : null}
    </RigidBody>
  );
}
