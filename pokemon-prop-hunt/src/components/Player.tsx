import { useEffect, useMemo, useRef, useState } from 'react';
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
const POKEMON_ACCELERATION = 10;
const POKEMON_MOVING_SPEED_THRESHOLD = 0.08;

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
  const yawTargetRef = useRef(0);
  const pitchTargetRef = useRef(0);
  const jumpHeldRef = useRef(false);
  const dodgeHeldRef = useRef(false);
  const groundedRef = useRef(false);
  const footstepTimerRef = useRef(0);
  const pokemonMovingRef = useRef(false);
  const lookEulerRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const pokemonVelocityRef = useRef(new THREE.Vector3());
  const moveDirection = useMemo(() => new THREE.Vector3(), []);
  const targetVelocity = useMemo(() => new THREE.Vector3(), []);
  const cameraTargetPosition = useMemo(() => new THREE.Vector3(), []);
  const cameraLookAt = useMemo(() => new THREE.Vector3(), []);
  const smoothLookAtRef = useRef(new THREE.Vector3());
  const smoothLookAtInitRef = useRef(false);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!pointerLocked) {
        return;
      }
      yawTargetRef.current -= event.movementX * 0.002;
      pitchTargetRef.current -= event.movementY * 0.002;
      pitchTargetRef.current = THREE.MathUtils.clamp(pitchTargetRef.current, -1.35, 1.35);
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

    // Role-dependent smoothing: 1st person needs near-instant response, 3rd person needs smooth follow
    const lookSmooth = role === 'trainer'
      ? 1 - Math.exp(-50 * delta)   // Fast, responsive for 1st person
      : 1 - Math.exp(-12 * delta);  // Smooth for 3rd person
    yawRef.current = THREE.MathUtils.lerp(yawRef.current, yawTargetRef.current, lookSmooth);
    pitchRef.current = THREE.MathUtils.lerp(pitchRef.current, pitchTargetRef.current, lookSmooth);

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
      pokemonVelocityRef.current.set(currentVel.x, 0, currentVel.z);
      if (keys.jump && !jumpHeldRef.current && groundedRef.current && pointerLocked) {
        body.applyImpulse({ x: 0, y: TRAINER_JUMP_IMPULSE, z: 0 }, true);
      }
      jumpHeldRef.current = keys.jump;

      // 1st person camera - direct quaternion (no double smoothing)
      lookEulerRef.current.set(pitchRef.current, yawRef.current, 0, 'YXZ');
      camera.quaternion.setFromEuler(lookEulerRef.current);
      cameraTargetPosition.set(translation.x, translation.y + EYE_HEIGHT, translation.z);
      camera.position.lerp(cameraTargetPosition, 1 - Math.exp(-25 * delta));
    } else {
      const speciesSpeed = selectedSpecies?.speed ?? 4.5;
      const boosted = escaping ? speciesSpeed * 1.55 : speciesSpeed;
      const currentVel = body.linvel();
      targetVelocity.set(
        pointerLocked && !isCaught ? moveDirection.x * boosted : 0,
        0,
        pointerLocked && !isCaught ? moveDirection.z * boosted : 0,
      );
      pokemonVelocityRef.current.lerp(targetVelocity, Math.min(1, POKEMON_ACCELERATION * delta));
      body.setLinvel(
        {
          x: pokemonVelocityRef.current.x,
          y: currentVel.y,
          z: pokemonVelocityRef.current.z,
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

      // 3rd person camera - smooth follow with smoothed lookAt target to prevent jitter
      const camSmooth = 1 - Math.exp(-8 * delta);
      cameraLookAt.set(translation.x, translation.y + 0.8, translation.z);
      if (!smoothLookAtInitRef.current) {
        smoothLookAtRef.current.copy(cameraLookAt);
        smoothLookAtInitRef.current = true;
      } else {
        smoothLookAtRef.current.lerp(cameraLookAt, 1 - Math.exp(-12 * delta));
      }
      const dist = 4.1;
      const height = 1.9;
      cameraTargetPosition.set(
        smoothLookAtRef.current.x + Math.sin(yawRef.current) * dist,
        smoothLookAtRef.current.y + height + Math.sin(pitchRef.current) * 0.6,
        smoothLookAtRef.current.z + Math.cos(yawRef.current) * dist,
      );
      camera.position.lerp(cameraTargetPosition, camSmooth);
      camera.lookAt(smoothLookAtRef.current);
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

    // Update pokemonMoving state for animation (only setState when changed to avoid unnecessary re-renders)
    const horizontalSpeedSq = pokemonVelocityRef.current.x ** 2 + pokemonVelocityRef.current.z ** 2;
    const movingNow =
      role === 'pokemon' && pointerLocked && !isCaught && horizontalSpeedSq > POKEMON_MOVING_SPEED_THRESHOLD ** 2;
    if (movingNow !== pokemonMovingRef.current) {
      pokemonMovingRef.current = movingNow;
      setPokemonMoving(movingNow);
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

  // Track pokemon moving state via useState so PokemonCharacter re-renders on change
  const [pokemonMoving, setPokemonMoving] = useState(false);

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      enabledRotations={[false, false, false]}
      position={[0, 0.5, 8]}
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
