import { useEffect, useMemo, useRef, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useKeyboard } from '../hooks/useKeyboard';
import { gameActions } from '../stores/gameSlice';
import { useAppDispatch, useAppSelector } from '../stores/hooks';
import { sendPosition } from '../stores/networkSlice';
import { soundManager } from '../systems/sound';
import PokemonCharacter, { getGroundOffset } from './PokemonCharacter';

interface PlayerProps {
  keysRef: ReturnType<typeof useKeyboard>;
  pointerLocked: boolean;
}

const TRAINER_WALK_SPEED = 5;
const TRAINER_SPRINT_SPEED = 7.8;
const TRAINER_JUMP_IMPULSE = 8;
const POKEMON_JUMP_IMPULSE = 7;
const MAX_JUMP_COUNT = 2;
const EYE_HEIGHT = 1.6;
const POKEMON_ACCELERATION = 10;
const POKEMON_MOVING_SPEED_THRESHOLD = 0.08;
const TRAINER_MOVING_SPEED_THRESHOLD = 0.08;

interface LocalTrainerModelProps {
  yaw: number;
  isMoving: boolean;
}

function LocalTrainerModel({ yaw, isMoving }: LocalTrainerModelProps) {
  const { scene, animations } = useGLTF('/models/ash_ketchum.glb');
  const activePokeballs = useAppSelector((state) => state.game.activePokeballs);
  const localPlayerId = useAppSelector((state) => state.network.playerId) || 'local-trainer';

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
    // Box3 reports ~0.5 units (bind-pose SkinnedMesh under-measures).
    // Runtime measurement shows actual animated height ~1.68 units at scale=1.0.
    // Target height: 1.7 units → scale ≈ 1.7 / 1.68 = 1.01 (effectively 1.0).
    const scale = 1.0;

    const clipMap: Record<string, THREE.AnimationClip> = {};
    for (const clip of animations) {
      if (clip.name === 'Sketchfab_modelAction') {
        continue;
      }
      const stripped = clip.clone();
      stripped.tracks = stripped.tracks.filter((track) => {
        // Strip ALL tracks that target the Sketchfab_model root node
        // (its -90° X rotation must remain untouched by animations)
        const dotIdx = track.name.lastIndexOf('.');
        const nodeName = dotIdx >= 0 ? track.name.slice(0, dotIdx) : track.name;
        if (nodeName === 'Sketchfab_model') return false;
        // Strip position tracks for non-bone nodes (prevents root displacement)
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
    // Start idle immediately with full weight — no fadeIn
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
      if (ball.ownerId === localPlayerId) {
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
  }, [activePokeballs, localPlayerId]);

  const animReadyRef = useRef(false);
  const outerGroupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    mixer.update(delta);
    // Show model only after animation is ready (prevents bind-pose face-down flash)
    if (outerGroupRef.current && animReadyRef.current && !outerGroupRef.current.visible) {
      outerGroupRef.current.visible = true;
    }
    if (isThrowingRef.current) {
      if (performance.now() >= throwingUntilRef.current) {
        const throwAction = throwActionRef.current;
        if (throwAction) {
          throwAction.fadeOut(0.12);
          throwAction.stop();
        }
        isThrowingRef.current = false;
        applyLocomotion(isMoving);
      }
    }
  });

  return (
    <group ref={outerGroupRef} visible={false} position={[0, -(0.45 + 0.35), 0]} rotation={[0, yaw, 0]}>
      <group scale={normalizedScale}>
        <primitive object={clonedScene} position={[-center.x, -minY, -center.z]} />
      </group>
    </group>
  );
}

export default function Player({ keysRef, pointerLocked }: PlayerProps) {
  const dispatch = useAppDispatch();
  const bodyRef = useRef<RapierRigidBody | null>(null);
  const { camera } = useThree();
  const { world, rapier } = useRapier();

  const role = useAppSelector((state) => state.game.role);
  const cameraMode = useAppSelector((state) => state.game.cameraMode);
  const isCaught = useAppSelector((state) => state.game.isCaught);
  const selectedSpecies = useAppSelector((state) => state.game.selectedSpecies);
  const escaping = useAppSelector((state) => state.game.escaping);
  const dodgeCooldown = useAppSelector((state) => state.game.dodgeCooldown);

  const playerId = useAppSelector((state) => state.network.playerId);
  const playerName = useAppSelector((state) => state.network.players[playerId]?.name ?? 'You');

  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const yawTargetRef = useRef(0);
  const pitchTargetRef = useRef(0);
  const jumpHeldRef = useRef(false);
  const groundedRef = useRef(false);
  const jumpCountRef = useRef(0);
  const footstepTimerRef = useRef(0);
  const pokemonMovingRef = useRef(false);
  const trainerMovingRef = useRef(false);
  const movementYawRef = useRef(0);
  const lookEulerRef = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const pokemonVelocityRef = useRef(new THREE.Vector3());
  const moveDirection = useMemo(() => new THREE.Vector3(), []);
  const targetVelocity = useMemo(() => new THREE.Vector3(), []);
  const cameraTargetPosition = useMemo(() => new THREE.Vector3(), []);
  const cameraLookAt = useMemo(() => new THREE.Vector3(), []);
  const smoothLookAtRef = useRef(new THREE.Vector3());
  const smoothLookAtInitRef = useRef(false);

  const [pokemonMoving, setPokemonMoving] = useState(false);
  const [trainerMoving, setTrainerMoving] = useState(false);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!pointerLocked) {
        return;
      }
      // Clamp to prevent sudden jerks from pointer lock activation or high-DPI spikes
      const mx = THREE.MathUtils.clamp(event.movementX, -100, 100);
      const my = THREE.MathUtils.clamp(event.movementY, -100, 100);
      yawTargetRef.current -= mx * 0.002;
      pitchTargetRef.current -= my * 0.002;
      pitchTargetRef.current = THREE.MathUtils.clamp(pitchTargetRef.current, -1.35, 1.35);
    };
    window.addEventListener('mousemove', onMouseMove);
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, [pointerLocked]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyV' && role === 'trainer') {
        dispatch(gameActions.toggleCameraMode());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, role]);

  useFrame((_, delta) => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    if (dodgeCooldown > 0) {
      dispatch(gameActions.setDodgeCooldown(Math.max(0, dodgeCooldown - delta)));
    }

    const keys = keysRef.current;
    const translation = body.translation();
    const ray = new rapier.Ray(
      { x: translation.x, y: translation.y, z: translation.z },
      { x: 0, y: -1, z: 0 },
    );
    groundedRef.current = world.castRay(ray, 1.1, true, undefined, undefined, undefined, body) !== null;
    if (groundedRef.current) {
      jumpCountRef.current = 0;
    }

    // Role-dependent smoothing: 1st person needs near-instant response, 3rd person needs smooth follow
    const lookSmooth = (role === 'trainer' && cameraMode === 'first-person')
      ? 1 - Math.exp(-50 * delta)
      : 1 - Math.exp(-12 * delta);
    yawRef.current = THREE.MathUtils.lerp(yawRef.current, yawTargetRef.current, lookSmooth);
    pitchRef.current = THREE.MathUtils.lerp(pitchRef.current, pitchTargetRef.current, lookSmooth);

    const forwardInput = (keys.backward ? 1 : 0) - (keys.forward ? 1 : 0);
    const strafeInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

    moveDirection.set(strafeInput, 0, forwardInput);
    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize().applyAxisAngle(THREE.Object3D.DEFAULT_UP, yawRef.current);
      if (role === 'pokemon') {
        movementYawRef.current = Math.atan2(-moveDirection.x, -moveDirection.z);
      }
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
      if (keys.jump && !jumpHeldRef.current && jumpCountRef.current < MAX_JUMP_COUNT && pointerLocked) {
        // Reset vertical velocity for double jump to feel responsive
        if (jumpCountRef.current > 0) {
          const vel = body.linvel();
          body.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
        }
        body.applyImpulse({ x: 0, y: TRAINER_JUMP_IMPULSE, z: 0 }, true);
        jumpCountRef.current += 1;
      }
      jumpHeldRef.current = keys.jump;

      const trainerHorizontalSpeedSq = currentVel.x ** 2 + currentVel.z ** 2;
      const trainerMovingNow = pointerLocked && trainerHorizontalSpeedSq > TRAINER_MOVING_SPEED_THRESHOLD ** 2;
      if (trainerMovingNow !== trainerMovingRef.current) {
        trainerMovingRef.current = trainerMovingNow;
        setTrainerMoving(trainerMovingNow);
      }

      if (cameraMode === 'first-person') {
        lookEulerRef.current.set(pitchRef.current, yawRef.current, 0, 'YXZ');
        camera.quaternion.setFromEuler(lookEulerRef.current);
        cameraTargetPosition.set(translation.x, translation.y + EYE_HEIGHT, translation.z);
        camera.position.lerp(cameraTargetPosition, 1 - Math.exp(-25 * delta));
      } else {
        const camSmooth = 1 - Math.exp(-8 * delta);
        cameraLookAt.set(translation.x, translation.y + 1.2, translation.z);
        if (!smoothLookAtInitRef.current) {
          smoothLookAtRef.current.copy(cameraLookAt);
          smoothLookAtInitRef.current = true;
        } else {
          smoothLookAtRef.current.lerp(cameraLookAt, 1 - Math.exp(-12 * delta));
        }
        const dist = 5;
        const height = 2.5;
        cameraTargetPosition.set(
          smoothLookAtRef.current.x + Math.sin(yawRef.current) * dist,
          smoothLookAtRef.current.y + height + Math.sin(pitchRef.current) * 0.8,
          smoothLookAtRef.current.z + Math.cos(yawRef.current) * dist,
        );
        camera.position.lerp(cameraTargetPosition, camSmooth);
        camera.lookAt(smoothLookAtRef.current);
      }
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

      if (keys.jump && !jumpHeldRef.current && jumpCountRef.current < MAX_JUMP_COUNT && pointerLocked && !isCaught) {
        // Reset vertical velocity for double jump to feel responsive
        if (jumpCountRef.current > 0) {
          const vel = body.linvel();
          body.setLinvel({ x: vel.x, y: 0, z: vel.z }, true);
        }
        body.applyImpulse({ x: 0, y: POKEMON_JUMP_IMPULSE, z: 0 }, true);
        jumpCountRef.current += 1;
      }
      jumpHeldRef.current = keys.jump;

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

    const syncYaw = role === 'pokemon' ? movementYawRef.current : yawRef.current;
    dispatch(
      gameActions.setLocalTransform({
        position: [translation.x, translation.y, translation.z],
        rotation: [pitchRef.current, syncYaw, 0],
      }),
    );
    dispatch(sendPosition([translation.x, translation.y, translation.z], [pitchRef.current, syncYaw, 0]));
  });

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
          position={[0, getGroundOffset(selectedSpecies.name), 0]}
          rotation={[0, movementYawRef.current, 0]}
          isMoving={pokemonMoving}
          escaping={escaping}
          invulnerable={escaping}
          isCaught={isCaught}
        />
      ) : null}
      {role === 'trainer' && cameraMode === 'third-person' ? (
        <LocalTrainerModel yaw={yawRef.current} isMoving={trainerMoving} />
      ) : null}
    </RigidBody>
  );
}
