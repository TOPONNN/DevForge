import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useGameStore } from '../stores/gameStore';
import { useNetworkStore } from '../stores/networkStore';
import { soundManager } from '../systems/sound';
import type { CatchAnimData, CatchResultPayload } from '../types/game';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const remap = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const T = {
  STARS_DURATION: 0.9,
  ESCAPE_DURATION: 0.7,
  CLEANUP_AFTER: 1.5,
  SAFETY_TIMEOUT: 15,
};

const PARTICLE_COUNT = 10;
const STAR_COUNT = 10;
const ELECTRIC_ARC_COUNT = 8;
const DEFAULT_SHAKE_COUNT: 1 | 2 | 3 = 3;
const TARGET_POKEBALL_DIAMETER = 0.4;

const POKEBALL_MODELS = {
  throw: '/models/pokeball/pokeball_01_throw.glb',
  openClose: '/models/pokeball/pokeball_02_open_close.glb',
  landing: '/models/pokeball/pokeball_03_landing.glb',
  wobble: '/models/pokeball/pokeball_04_wobble.glb',
  success: '/models/pokeball/pokeball_05_capture_success.glb',
  fail: '/models/pokeball/pokeball_06_capture_fail.glb',
} as const;

type AnimPhase = 'open_close' | 'landing' | 'wobble' | 'success' | 'fail';

const PHASE_CLIPS: Record<AnimPhase, string[]> = {
  open_close: ['02_open_close_SC', '02_open_close_Upper'],
  landing: ['03_landing_SC', '03_landing_Upper'],
  wobble: ['04_wobble_SC', '04_wobble_Upper'],
  success: ['05_capture_success_SC', '05_capture_success_Upper'],
  fail: ['06_capture_fail_SC', '06_capture_fail_Upper'],
};

const PHASE_FALLBACK_DURATION: Record<AnimPhase, number> = {
  open_close: 1.0,
  landing: 1.17,
  wobble: 3.96,
  success: 2.29,
  fail: 4.79,
};

export default function CatchAnimation3D() {
  const catchAnim = useGameStore((s) => s.catchAnim);
  if (!catchAnim) return null;
  return <CatchSequence key={catchAnim.id} data={catchAnim} />;
}

function CatchSequence({ data }: { data: CatchAnimData }) {
  const playerId = useNetworkStore((s) => s.playerId);
  const pendingCatchResult = useGameStore((s) => s.pendingCatchResult);
  const clearCatchAnim = useGameStore((s) => s.clearCatchAnim);
  const clearCatchAttemptResult = useGameStore((s) => s.clearCatchAttemptResult);
  const clearPendingCatchResult = useGameStore((s) => s.clearPendingCatchResult);
  const setCatchAnimPhase = useGameStore((s) => s.setCatchAnimPhase);
  const registerCatch = useGameStore((s) => s.registerCatch);
  const registerEscape = useGameStore((s) => s.registerEscape);
  const setCaught = useGameStore((s) => s.setCaught);

  const openCloseGLB = useGLTF(POKEBALL_MODELS.openClose);
  const throwGLB = useGLTF(POKEBALL_MODELS.throw);
  const landingGLB = useGLTF(POKEBALL_MODELS.landing);
  const wobbleGLB = useGLTF(POKEBALL_MODELS.wobble);
  const successGLB = useGLTF(POKEBALL_MODELS.success);
  const failGLB = useGLTF(POKEBALL_MODELS.fail);

  const ballGroupRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const orbRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Group>(null);
  const electricArcsRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const sealRef = useRef<THREE.Mesh>(null);
  const escapeFlashRef = useRef<THREE.Mesh>(null);
  const innerGlowRef = useRef<THREE.Mesh>(null);

  const buttonMaterialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const phaseRef = useRef<AnimPhase>('open_close');
  const phaseStartRef = useRef(0);
  const phaseDurationRef = useRef(PHASE_FALLBACK_DURATION.open_close);
  const phaseCompleteRef = useRef(false);
  const phaseStartedRef = useRef(false);
  const activeActionsRef = useRef<THREE.AnimationAction[]>([]);
  const expectedFinishCountRef = useRef(0);
  const finishedCountRef = useRef(0);
  const playedShakesRef = useRef<Set<number>>(new Set());
  const appliedResultRef = useRef<CatchResultPayload | null>(null);
  const resultStartRef = useRef<number | null>(null);
  const cleanupAtRef = useRef<number | null>(null);
  const phaseEnteredAtRef = useRef<Record<AnimPhase, number | null>>({
    open_close: null,
    landing: null,
    wobble: null,
    success: null,
    fail: null,
  });

  const ballStartY = data.pokemonPosition[1] + 0.5;

  const particleSeeds = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        angle: (i / PARTICLE_COUNT) * Math.PI * 2 + Math.random() * 0.5,
        radius: 0.3 + Math.random() * 0.4,
        speed: 0.7 + Math.random() * 0.5,
        delay: i * 0.06,
        yOffset: (Math.random() - 0.5) * 0.6,
      })),
    [],
  );

  const starSeeds = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        angle: (i / STAR_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
        speed: 0.5 + Math.random() * 0.5,
        yBias: Math.random() * 0.3,
      })),
    [],
  );

  const arcSeeds = useMemo(
    () =>
      Array.from({ length: ELECTRIC_ARC_COUNT }, (_, i) => ({
        angle: (i / ELECTRIC_ARC_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.35,
        orbitSpeed: 1.8 + Math.random() * 2.8,
        yOffset: (Math.random() - 0.5) * 0.38,
        flickerSpeed: 10 + Math.random() * 12,
        flickerPhase: Math.random() * Math.PI * 2,
      })),
    [],
  );

  const allClipsByName = useMemo(() => {
    const clipMap = new Map<string, THREE.AnimationClip>();
    const all = [
      ...throwGLB.animations,
      ...openCloseGLB.animations,
      ...landingGLB.animations,
      ...wobbleGLB.animations,
      ...successGLB.animations,
      ...failGLB.animations,
    ];
    for (const clip of all) {
      if (!clipMap.has(clip.name)) {
        clipMap.set(clip.name, clip);
      }
    }
    return clipMap;
  }, [
    failGLB.animations,
    landingGLB.animations,
    openCloseGLB.animations,
    successGLB.animations,
    throwGLB.animations,
    wobbleGLB.animations,
  ]);

  const clonedScene = useMemo(() => {
    const cloned = cloneSkeleton(openCloseGLB.scene) as THREE.Object3D;
    cloned.traverse((child: THREE.Object3D) => {
      if (!(child as THREE.Mesh).isMesh) {
        return;
      }
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((mat) => mat.clone());
      } else if (mesh.material) {
        mesh.material = mesh.material.clone();
      }
    });
    return cloned;
  }, [openCloseGLB.scene]);

  const pokeballModelScale = useMemo(() => {
    clonedScene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(clonedScene);
    if (bounds.isEmpty() || !isFinite(bounds.min.x) || !isFinite(bounds.max.x)) {
      return 0.2;
    }

    const size = new THREE.Vector3();
    bounds.getSize(size);
    const naturalDiameter = Math.max(size.x, size.y);
    if (naturalDiameter <= 0.0001 || !isFinite(naturalDiameter)) {
      return 0.2;
    }

    return TARGET_POKEBALL_DIAMETER / naturalDiameter;
  }, [clonedScene]);

  const mixer = useMemo(() => new THREE.AnimationMixer(clonedScene), [clonedScene]);

  const phaseDurationFor = useCallback(
    (phase: AnimPhase) => {
      const clips = PHASE_CLIPS[phase]
        .map((clipName) => allClipsByName.get(clipName))
        .filter((clip): clip is THREE.AnimationClip => Boolean(clip));
      if (clips.length === 0) {
        return PHASE_FALLBACK_DURATION[phase];
      }
      return Math.max(...clips.map((clip) => clip.duration), PHASE_FALLBACK_DURATION[phase]);
    },
    [allClipsByName],
  );

  const playPhase = useCallback(
    (phase: AnimPhase, elapsedNow: number) => {
      const currentMixer = mixerRef.current;
      if (!currentMixer) {
        return;
      }

      for (const prev of activeActionsRef.current) {
        prev.stop();
      }
      activeActionsRef.current = [];
      expectedFinishCountRef.current = 0;
      finishedCountRef.current = 0;

      const actions: THREE.AnimationAction[] = [];
      const clips = PHASE_CLIPS[phase]
        .map((name) => allClipsByName.get(name))
        .filter((clip): clip is THREE.AnimationClip => Boolean(clip));

      for (const clip of clips) {
        const action = currentMixer.clipAction(clip, clonedScene);
        action.enabled = true;
        action.reset();
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.play();
        actions.push(action);
      }

      activeActionsRef.current = actions;
      expectedFinishCountRef.current = actions.length;
      phaseRef.current = phase;
      phaseStartRef.current = elapsedNow;
      phaseDurationRef.current = phaseDurationFor(phase);
      phaseCompleteRef.current = actions.length === 0;
      phaseEnteredAtRef.current[phase] = elapsedNow;

      if (phase === 'wobble') {
        playedShakesRef.current.clear();
      }
    },
    [allClipsByName, clonedScene, phaseDurationFor],
  );

  const applyResult = useCallback(
    (result: CatchResultPayload, elapsedNow: number) => {
      if (appliedResultRef.current) {
        return;
      }

      appliedResultRef.current = result;
      resultStartRef.current = elapsedNow;
      setCatchAnimPhase('result');

      if (result.result === 'caught') {
        soundManager.play('catch_success');
        registerCatch(result.pokemonId, result.pokemonName);
        if (result.pokemonId === playerId) {
          setCaught(true);
        }
        playPhase('success', elapsedNow);
      } else {
        soundManager.play('catch_fail');
        registerEscape(result.pokemonName);
        playPhase('fail', elapsedNow);
      }

      cleanupAtRef.current = elapsedNow + phaseDurationRef.current + T.CLEANUP_AFTER;
    },
    [playPhase, playerId, registerCatch, registerEscape, setCatchAnimPhase, setCaught],
  );

  useEffect(() => {
    mixerRef.current = mixer;

    const onFinished = (event: THREE.Event & { type: 'finished'; action: THREE.AnimationAction }) => {
      if (!activeActionsRef.current.includes(event.action)) {
        return;
      }
      finishedCountRef.current += 1;
      if (finishedCountRef.current >= expectedFinishCountRef.current) {
        phaseCompleteRef.current = true;
      }
    };

    mixer.addEventListener('finished', onFinished);

    return () => {
      mixer.removeEventListener('finished', onFinished);
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      mixerRef.current = null;
    };
  }, [clonedScene, mixer]);

  useEffect(() => {
    let buttonMaterial: THREE.MeshStandardMaterial | null = null;
    clonedScene.traverse((child: THREE.Object3D) => {
      if (!(child as THREE.Mesh).isMesh || buttonMaterial) {
        return;
      }
      const mesh = child as THREE.Mesh;
      if (mesh.name !== 'PokeBall_ButtonCenter' && mesh.name !== 'PokeBall_ButtonInner') {
        return;
      }
      const candidate = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      if (candidate && candidate instanceof THREE.MeshStandardMaterial) {
        buttonMaterial = candidate;
      }
    });
    buttonMaterialRef.current = buttonMaterial;

    return () => {
      buttonMaterialRef.current = null;
    };
  }, [clonedScene]);

  useEffect(() => {
    return () => {
      clonedScene.traverse((child: THREE.Object3D) => {
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
  }, [clonedScene]);

  useFrame((_, delta) => {
    const elapsed = (performance.now() - data.startTime) / 1000;
    const bp = data.ballPosition;
    const pp = data.pokemonPosition;
    const shakeCount = pendingCatchResult?.shakeCount ?? DEFAULT_SHAKE_COUNT;

    if (!phaseStartedRef.current) {
      phaseStartedRef.current = true;
      playPhase('open_close', elapsed);
    }

    mixerRef.current?.update(delta);

    if (phaseRef.current === 'open_close' && phaseCompleteRef.current) {
      playPhase('landing', elapsed);
    } else if (phaseRef.current === 'landing' && phaseCompleteRef.current) {
      playPhase('wobble', elapsed);
    } else if (phaseRef.current === 'wobble' && phaseCompleteRef.current && pendingCatchResult && !appliedResultRef.current) {
      applyResult(pendingCatchResult, elapsed);
    }

    if (phaseRef.current === 'wobble') {
      const wobbleStart = phaseStartRef.current;
      const wobbleDuration = Math.max(phaseDurationRef.current, 0.001);
      const perShake = wobbleDuration / shakeCount;
      for (let shake = 0; shake < shakeCount; shake++) {
        const shakeStart = wobbleStart + perShake * shake;
        if (elapsed >= shakeStart && !playedShakesRef.current.has(shake)) {
          playedShakesRef.current.add(shake);
          soundManager.play('catch_wiggle');
        }
      }
    }

    const openStart = phaseEnteredAtRef.current.open_close;
    const openDuration = phaseDurationFor('open_close');
    const landingStart = phaseEnteredAtRef.current.landing;
    const landingDuration = phaseDurationFor('landing');

    if (flashRef.current && openStart !== null) {
      const flashDuration = Math.min(0.3, openDuration * 0.45);
      const vis = elapsed >= openStart && elapsed < openStart + flashDuration;
      flashRef.current.visible = vis;
      if (vis) {
        const t = remap(elapsed, openStart, openStart + flashDuration);
        flashRef.current.scale.setScalar(0.25 + t * 2.6);
        const mat = flashRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.95 * (1 - t);
      }
    }

    if (orbRef.current && openStart !== null) {
      const absorbStart = openStart + openDuration * 0.2;
      const absorbEnd = openStart + openDuration * 0.95;
      const vis = elapsed >= absorbStart && elapsed < absorbEnd + 0.1;
      orbRef.current.visible = vis;
      if (vis) {
        const t = easeOutCubic(remap(elapsed, absorbStart, absorbEnd));
        const ox = lerp(0, bp[0] - pp[0], t);
        const oy = lerp(0.3, ballStartY - pp[1], t);
        const oz = lerp(0, bp[2] - pp[2], t);
        orbRef.current.position.set(ox, oy, oz);
        orbRef.current.scale.setScalar(Math.max(0.03, (1 - t) * 0.82));
        const mat = orbRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.85 * (1 - t * 0.4);
      }
    }

    if (particlesRef.current && openStart !== null) {
      const absorbStart = openStart + openDuration * 0.2;
      const absorbEnd = openStart + openDuration * 0.95;
      const vis = elapsed >= absorbStart && elapsed < absorbEnd;
      particlesRef.current.visible = vis;
      if (vis) {
        const children = particlesRef.current.children;
        for (let i = 0; i < children.length; i++) {
          const s = particleSeeds[i];
          const pt = clamp01((elapsed - absorbStart - s.delay) / ((absorbEnd - absorbStart) * s.speed));
          const e = easeOutCubic(pt);
          const pathAngle = s.angle + e * Math.PI * 1.5;
          const pathR = s.radius * (1 - e);
          const ox = lerp(Math.cos(pathAngle) * pathR, bp[0] - pp[0], e);
          const oy = lerp(s.yOffset + 0.5, ballStartY - pp[1], e);
          const oz = lerp(Math.sin(pathAngle) * pathR, bp[2] - pp[2], e);
          children[i].position.set(ox, oy, oz);
          children[i].scale.setScalar(Math.max(0.01, Math.sin(pt * Math.PI) * 0.12));
        }
      }
    }

    if (electricArcsRef.current && openStart !== null) {
      const absorbStart = openStart + openDuration * 0.2;
      const arcEnd = openStart + openDuration;
      const vis = elapsed >= absorbStart && elapsed < arcEnd;
      electricArcsRef.current.visible = vis;
      if (vis) {
        const children = electricArcsRef.current.children;
        const now = performance.now() * 0.001;
        for (let i = 0; i < children.length; i++) {
          const s = arcSeeds[i];
          const orbT = now * s.orbitSpeed + s.angle;
          const mesh = children[i] as THREE.Mesh;
          const orbitRadius = 0.35 + ((Math.sin(now * 0.9 + i * 1.13) + 1) * 0.5) * 0.15;
          mesh.position.set(
            Math.cos(orbT) * orbitRadius,
            s.yOffset + Math.sin(orbT * 1.7) * 0.08,
            0.25 + Math.sin(orbT) * orbitRadius,
          );

          const flicker = Math.sin(now * s.flickerSpeed + s.flickerPhase);
          const pulse = (Math.sin(now * (s.flickerSpeed * 0.7) + s.flickerPhase * 0.6) + 1) * 0.5;
          const visibleFlicker = flicker > -0.15;
          mesh.visible = visibleFlicker;
          mesh.scale.setScalar(visibleFlicker ? pulse * 0.08 : 0);
        }
      }
    }

    if (innerGlowRef.current && openStart !== null) {
      const escapedPhase =
        appliedResultRef.current?.result === 'escaped' &&
        resultStartRef.current !== null &&
        elapsed >= resultStartRef.current;
      const openVis = elapsed >= openStart && elapsed < openStart + openDuration;
      const visible = openVis || escapedPhase;
      innerGlowRef.current.visible = visible;
      if (visible) {
        let intensity = 0;
        if (openVis) {
          const local = remap(elapsed, openStart, openStart + openDuration);
          intensity = Math.sin(local * Math.PI);
        } else if (resultStartRef.current !== null) {
          intensity = remap(elapsed, resultStartRef.current, resultStartRef.current + 0.3);
        }
        const mat = innerGlowRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = intensity * 0.75;
        innerGlowRef.current.scale.setScalar(0.15 + intensity * 0.12);
      }
    }

    if (lightRef.current && openStart !== null) {
      const peakAt = openStart + openDuration * 0.38;
      const landingEnd = landingStart === null ? peakAt : landingStart + landingDuration;
      if (elapsed >= openStart && elapsed < landingEnd) {
        const ramp = easeOutCubic(remap(elapsed, openStart, peakAt));
        const fade = 1 - remap(elapsed, peakAt, landingEnd);
        lightRef.current.intensity = ramp * fade * 5;
      } else {
        lightRef.current.intensity = 0;
      }
    }

    if (sealRef.current && openStart !== null) {
      const sealStart = openStart + openDuration - 0.1;
      const sealEnd = openStart + openDuration + 0.3;
      const vis = elapsed >= sealStart && elapsed < sealEnd;
      sealRef.current.visible = vis;
      if (vis) {
        const t = remap(elapsed, sealStart, sealEnd);
        sealRef.current.scale.setScalar(0.08 + t * 0.5);
        const mat = sealRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.9 * (1 - t);
      }
    }

    if (starsRef.current) {
      const show = appliedResultRef.current?.result === 'caught' && resultStartRef.current !== null && elapsed >= resultStartRef.current;
      starsRef.current.visible = show;
      if (show && resultStartRef.current !== null) {
        const t = remap(elapsed, resultStartRef.current, resultStartRef.current + T.STARS_DURATION);
        const children = starsRef.current.children;
        for (let i = 0; i < children.length; i++) {
          const s = starSeeds[i];
          const d = i * 0.04;
          const ct = clamp01((t - d) / (1 - d * 0.3));
          const a = s.angle + ct * Math.PI * 0.7;
          const r = 0.15 + ct * 0.65 * s.speed;
          children[i].position.set(
            Math.cos(a) * r,
            0.3 + ct * 0.5 + s.yBias + Math.sin(ct * Math.PI) * 0.3,
            Math.sin(a) * r,
          );
          children[i].scale.setScalar(Math.sin(ct * Math.PI) * 0.1);
        }
      }
    }

    if (escapeFlashRef.current) {
      const show = appliedResultRef.current?.result === 'escaped' && resultStartRef.current !== null && elapsed >= resultStartRef.current;
      escapeFlashRef.current.visible = show;
      if (show && resultStartRef.current !== null) {
        const t = remap(elapsed, resultStartRef.current, resultStartRef.current + T.ESCAPE_DURATION);
        escapeFlashRef.current.scale.setScalar(0.1 + t * 1.5);
        const mat = escapeFlashRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.75 * (1 - t);
      }
    }

    if (buttonMaterialRef.current) {
      const mat = buttonMaterialRef.current;
      if (phaseRef.current === 'wobble') {
        const wobbleDuration = Math.max(phaseDurationRef.current, 0.001);
        const perShake = wobbleDuration / shakeCount;
        const wt = elapsed - phaseStartRef.current;
        const frac = clamp01((wt % perShake) / perShake);
        const pulse = Math.max(0, 1 - frac * 1.6);
        mat.emissive.setHex(0xff2200);
        mat.emissiveIntensity = pulse * 1.8;
      } else if (
        appliedResultRef.current?.result === 'caught' &&
        resultStartRef.current !== null &&
        elapsed >= resultStartRef.current
      ) {
        const t = remap(elapsed, resultStartRef.current, resultStartRef.current + 0.4);
        mat.emissive.setHex(0xffdd44);
        mat.emissiveIntensity = (1 - t) * 2.5;
      } else {
        mat.emissiveIntensity = 0;
      }
    }

    if (phaseRef.current === 'wobble' && phaseCompleteRef.current && pendingCatchResult && !appliedResultRef.current) {
      applyResult(pendingCatchResult, elapsed);
    }

    if (appliedResultRef.current && cleanupAtRef.current !== null && elapsed >= cleanupAtRef.current) {
      clearCatchAnim();
      clearCatchAttemptResult();
      clearPendingCatchResult();
    }

    if (elapsed >= T.SAFETY_TIMEOUT) {
      clearCatchAnim();
      clearCatchAttemptResult();
      clearPendingCatchResult();
    }
  });

  const bp = data.ballPosition;
  const pp = data.pokemonPosition;

  return (
    <group>
      <group ref={ballGroupRef} position={[bp[0], ballStartY, bp[2]]} scale={1.0}>
        <primitive object={clonedScene} scale={pokeballModelScale} />

        <mesh ref={innerGlowRef} visible={false}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>

        <pointLight ref={lightRef} color="#FF4422" intensity={0} distance={7} decay={2} />

        <mesh ref={sealRef} position={[0, 0, 0.28]} visible={false}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>

        <group ref={starsRef} visible={false}>
          {starSeeds.map((_, i) => (
            <mesh key={i}>
              <octahedronGeometry args={[0.06, 0]} />
              <meshBasicMaterial color="#FFD700" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          ))}
        </group>

        <group ref={electricArcsRef} visible={false}>
          {arcSeeds.map((_, i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.04, 6, 6]} />
              <meshBasicMaterial color="#FF4466" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          ))}
        </group>

        <mesh ref={escapeFlashRef} visible={false}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshBasicMaterial color="#FF4444" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      <mesh ref={flashRef} position={[bp[0], ballStartY, bp[2]]} visible={false}>
        <sphereGeometry args={[1.2, 18, 18]} />
        <meshBasicMaterial color="#FF6633" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <group position={[pp[0], pp[1], pp[2]]}>
        <mesh ref={orbRef} visible={false}>
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshBasicMaterial color="#FF6B6B" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      <group ref={particlesRef} position={[pp[0], pp[1], pp[2]]} visible={false}>
        {particleSeeds.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial color="#FF4444" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

useGLTF.preload(POKEBALL_MODELS.throw);
useGLTF.preload(POKEBALL_MODELS.openClose);
useGLTF.preload(POKEBALL_MODELS.landing);
useGLTF.preload(POKEBALL_MODELS.wobble);
useGLTF.preload(POKEBALL_MODELS.success);
useGLTF.preload(POKEBALL_MODELS.fail);
