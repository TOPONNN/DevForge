import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../stores/gameStore';
import type { CatchAnimData } from '../types/game';

// ─── Helpers ────────────────────────────────────────────────────────
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const remap = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutQuad = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ─── Timeline (seconds) ─────────────────────────────────────────────
const T = {
  FLASH_START: 0,
  FLASH_END: 0.3,
  OPEN_START: 0.15,
  OPEN_END: 0.55,
  ABSORB_START: 0.25,
  ABSORB_END: 1.2,
  CLOSE_START: 1.2,
  CLOSE_END: 1.5,
  DROP_START: 1.5,
  DROP_END: 1.8,
  WIGGLE_START: 2.0,
  WIGGLE_EACH: 0.55,
  RESULT_DELAY: 0.35,
  STARS_DURATION: 0.9,
  ESCAPE_DURATION: 0.6,
  CLEANUP_AFTER: 1.2,
};

const PARTICLE_COUNT = 10;
const STAR_COUNT = 10;
const GROUND_Y = 0.3;

// ─── Main Export ────────────────────────────────────────────────────
export default function CatchAnimation3D() {
  const catchAnim = useGameStore((s) => s.catchAnim);
  if (!catchAnim) return null;
  return <CatchSequence key={catchAnim.id} data={catchAnim} />;
}

// ─── Inner Sequence ─────────────────────────────────────────────────
function CatchSequence({ data }: { data: CatchAnimData }) {
  const catchAttemptResult = useGameStore((s) => s.catchAttemptResult);
  const clearCatchAnim = useGameStore((s) => s.clearCatchAnim);
  const clearCatchAttemptResult = useGameStore(
    (s) => s.clearCatchAttemptResult,
  );

  // ── Refs for animated nodes ──
  const ballGroupRef = useRef<THREE.Group>(null);
  const topHingeRef = useRef<THREE.Group>(null);
  const innerGlowRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const orbRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const sealRef = useRef<THREE.Mesh>(null);
  const escapeFlashRef = useRef<THREE.Mesh>(null);

  // ── Pre-computed ──
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
        angle:
          (i / STAR_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.4,
        speed: 0.5 + Math.random() * 0.5,
        yBias: Math.random() * 0.3,
      })),
    [],
  );

  // ── Animation loop ──
  useFrame(() => {
    const elapsed = (performance.now() - data.startTime) / 1000;
    const bp = data.ballPosition;
    const pp = data.pokemonPosition;
    const wiggleEnd = T.WIGGLE_START + data.shakeCount * T.WIGGLE_EACH;
    const resultStart = wiggleEnd + T.RESULT_DELAY;

    // ────── BALL POSITION + WIGGLE ──────
    const ball = ballGroupRef.current;
    if (ball) {
      const dropT = easeOutCubic(remap(elapsed, T.DROP_START, T.DROP_END));
      const currentY = lerp(ballStartY, GROUND_Y, dropT);
      ball.position.set(bp[0], currentY, bp[2]);

      if (elapsed >= T.WIGGLE_START && elapsed < wiggleEnd) {
        const wt = elapsed - T.WIGGLE_START;
        const idx = Math.floor(wt / T.WIGGLE_EACH);
        const frac = wt / T.WIGGLE_EACH - idx;
        const amp = 0.3 * Math.pow(0.6, idx);
        ball.rotation.z = Math.sin(frac * Math.PI * 2) * amp;
      } else if (elapsed >= wiggleEnd) {
        ball.rotation.z *= 0.85;
      }
    }

    // ────── TOP HALF HINGE ──────
    if (topHingeRef.current) {
      const openT = easeInOutQuad(remap(elapsed, T.OPEN_START, T.OPEN_END));
      const closeT = easeInOutQuad(
        remap(elapsed, T.CLOSE_START, T.CLOSE_END),
      );
      // Escape: re-open after wiggle
      let escapeOpen = 0;
      if (
        catchAttemptResult?.result === 'escaped' &&
        elapsed >= resultStart
      ) {
        escapeOpen = easeOutCubic(
          remap(elapsed, resultStart, resultStart + 0.3),
        );
      }
      const openAngle =
        Math.max(0, openT - closeT + escapeOpen) * Math.PI * 0.6;
      topHingeRef.current.rotation.x = -openAngle;
    }

    // ────── INNER GLOW ──────
    if (innerGlowRef.current) {
      const vis =
        (elapsed >= T.OPEN_START && elapsed < T.CLOSE_END) ||
        (catchAttemptResult?.result === 'escaped' && elapsed >= resultStart);
      innerGlowRef.current.visible = vis;
      if (vis) {
        let intensity: number;
        if (elapsed < T.CLOSE_START) {
          intensity = remap(elapsed, T.OPEN_START, T.OPEN_END);
        } else if (elapsed < T.CLOSE_END) {
          intensity = 1 - remap(elapsed, T.CLOSE_START, T.CLOSE_END);
        } else {
          intensity = remap(elapsed, resultStart, resultStart + 0.3);
        }
        const mat = innerGlowRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = intensity * 0.7;
        innerGlowRef.current.scale.setScalar(0.15 + intensity * 0.12);
      }
    }

    // ────── POINT LIGHT ──────
    if (lightRef.current) {
      const active = elapsed >= T.OPEN_START && elapsed < T.CLOSE_END + 0.2;
      if (active) {
        const ramp = easeOutCubic(
          remap(elapsed, T.OPEN_START, T.OPEN_END),
        );
        const fade =
          elapsed < T.CLOSE_START
            ? 1
            : 1 - remap(elapsed, T.CLOSE_START, T.CLOSE_END + 0.2);
        lightRef.current.intensity = ramp * fade * 3;
      } else {
        lightRef.current.intensity = 0;
      }
    }

    // ────── IMPACT FLASH ──────
    if (flashRef.current) {
      const vis = elapsed >= T.FLASH_START && elapsed < T.FLASH_END;
      flashRef.current.visible = vis;
      if (vis) {
        const t = remap(elapsed, T.FLASH_START, T.FLASH_END);
        flashRef.current.scale.setScalar(0.2 + t * 2.5);
        const mat = flashRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.9 * (1 - t);
      }
    }

    // ────── ABSORPTION ORB ──────
    if (orbRef.current) {
      const vis = elapsed >= T.ABSORB_START && elapsed < T.CLOSE_START + 0.1;
      orbRef.current.visible = vis;
      if (vis) {
        const t = easeOutCubic(
          remap(elapsed, T.ABSORB_START, T.ABSORB_END),
        );
        const ox = lerp(0, bp[0] - pp[0], t);
        const oy = lerp(0.3, ballStartY - pp[1], t);
        const oz = lerp(0, bp[2] - pp[2], t);
        orbRef.current.position.set(ox, oy, oz);
        orbRef.current.scale.setScalar(Math.max(0.03, (1 - t) * 0.8));
        const mat = orbRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.85 * (1 - t * 0.4);
      }
    }

    // ────── ENERGY PARTICLES ──────
    if (particlesRef.current) {
      const vis = elapsed >= T.ABSORB_START && elapsed < T.CLOSE_START;
      particlesRef.current.visible = vis;
      if (vis) {
        const children = particlesRef.current.children;
        for (let i = 0; i < children.length; i++) {
          const s = particleSeeds[i];
          const pt = clamp01(
            (elapsed - T.ABSORB_START - s.delay) /
              ((T.ABSORB_END - T.ABSORB_START) * s.speed),
          );
          const e = easeOutCubic(pt);
          const pathAngle = s.angle + e * Math.PI * 1.5;
          const pathR = s.radius * (1 - e);
          const ox = lerp(
            Math.cos(pathAngle) * pathR,
            bp[0] - pp[0],
            e,
          );
          const oy = lerp(s.yOffset + 0.5, ballStartY - pp[1], e);
          const oz = lerp(
            Math.sin(pathAngle) * pathR,
            bp[2] - pp[2],
            e,
          );
          children[i].position.set(ox, oy, oz);
          children[i].scale.setScalar(
            Math.max(0.01, Math.sin(pt * Math.PI) * 0.12),
          );
        }
      }
    }

    // ────── SEAL FLASH ──────
    if (sealRef.current) {
      const vis =
        elapsed >= T.CLOSE_END - 0.1 && elapsed < T.CLOSE_END + 0.3;
      sealRef.current.visible = vis;
      if (vis) {
        const t = remap(elapsed, T.CLOSE_END - 0.1, T.CLOSE_END + 0.3);
        sealRef.current.scale.setScalar(0.08 + t * 0.5);
        const mat = sealRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.9 * (1 - t);
      }
    }

    // ────── RESULT: SUCCESS STARS ──────
    if (starsRef.current) {
      const show =
        catchAttemptResult?.result === 'caught' && elapsed >= resultStart;
      starsRef.current.visible = show;
      if (show) {
        const t = remap(
          elapsed,
          resultStart,
          resultStart + T.STARS_DURATION,
        );
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

    // ────── RESULT: ESCAPE FLASH ──────
    if (escapeFlashRef.current) {
      const show =
        catchAttemptResult?.result === 'escaped' && elapsed >= resultStart;
      escapeFlashRef.current.visible = show;
      if (show) {
        const t = remap(
          elapsed,
          resultStart,
          resultStart + T.ESCAPE_DURATION,
        );
        escapeFlashRef.current.scale.setScalar(0.1 + t * 1.5);
        const mat = escapeFlashRef.current
          .material as THREE.MeshBasicMaterial;
        mat.opacity = 0.7 * (1 - t);
      }
    }

    // ────── CLEANUP ──────
    if (catchAttemptResult) {
      const resultEnd =
        catchAttemptResult.result === 'caught'
          ? resultStart + T.STARS_DURATION
          : resultStart + T.ESCAPE_DURATION;
      if (elapsed > resultEnd + T.CLEANUP_AFTER) {
        clearCatchAnim();
        clearCatchAttemptResult();
      }
    }
    // Safety: clean up if server never responds (8s timeout)
    if (elapsed > 8) {
      clearCatchAnim();
    }
  });

  // ── Render ──
  const bp = data.ballPosition;
  const pp = data.pokemonPosition;

  return (
    <group>
      {/* ═══ Animated Pokeball ═══ */}
      <group ref={ballGroupRef} position={[bp[0], ballStartY, bp[2]]}>
        {/* Top half — hinged at back edge */}
        <group position={[0, 0, -0.3]}>
          <group ref={topHingeRef}>
            <group position={[0, 0, 0.3]}>
              <mesh castShadow>
                <sphereGeometry
                  args={[0.3, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2]}
                />
                <meshStandardMaterial
                  color="#E63946"
                  roughness={0.28}
                  metalness={0.14}
                />
              </mesh>
            </group>
          </group>
        </group>

        {/* Bottom half */}
        <mesh castShadow>
          <sphereGeometry
            args={[0.3, 20, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]}
          />
          <meshStandardMaterial
            color="#F8F9FA"
            roughness={0.22}
            metalness={0.08}
          />
        </mesh>

        {/* Band */}
        <mesh>
          <torusGeometry args={[0.3, 0.02, 8, 24]} />
          <meshStandardMaterial color="#111111" />
        </mesh>

        {/* Button outer */}
        <mesh position={[0, 0, 0.3]}>
          <cylinderGeometry args={[0.06, 0.06, 0.025, 16]} />
          <meshStandardMaterial color="#111111" />
        </mesh>

        {/* Button inner */}
        <mesh position={[0, 0, 0.31]}>
          <cylinderGeometry args={[0.04, 0.04, 0.025, 16]} />
          <meshStandardMaterial
            color="#F8F9FA"
            emissive="#ffffff"
            emissiveIntensity={0.3}
          />
        </mesh>

        {/* Inner glow (visible when ball is open) */}
        <mesh ref={innerGlowRef} visible={false}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshBasicMaterial
            color="#FFFFFF"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Point light inside ball */}
        <pointLight
          ref={lightRef}
          color="#FF8844"
          intensity={0}
          distance={5}
          decay={2}
        />

        {/* Seal flash (button glow when closing) */}
        <mesh ref={sealRef} position={[0, 0, 0.32]} visible={false}>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshBasicMaterial
            color="#FFFFFF"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Success stars */}
        <group ref={starsRef} visible={false}>
          {starSeeds.map((_, i) => (
            <mesh key={i}>
              <octahedronGeometry args={[0.08, 0]} />
              <meshBasicMaterial
                color="#FFD700"
                transparent
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          ))}
        </group>

        {/* Escape flash (red burst when pokemon escapes) */}
        <mesh ref={escapeFlashRef} visible={false}>
          <sphereGeometry args={[0.8, 14, 14]} />
          <meshBasicMaterial
            color="#FF4444"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ═══ Impact Flash ═══ */}
      <mesh
        ref={flashRef}
        position={[bp[0], ballStartY, bp[2]]}
        visible={false}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color="#FFFFFF"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ═══ Absorption Orb (at pokemon position, moves to ball) ═══ */}
      <group position={[pp[0], pp[1], pp[2]]}>
        <mesh ref={orbRef} visible={false}>
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshBasicMaterial
            color="#FF6B6B"
            transparent
            opacity={0.8}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ═══ Energy Particles (spiral from pokemon to ball) ═══ */}
      <group
        ref={particlesRef}
        position={[pp[0], pp[1], pp[2]]}
        visible={false}
      >
        {particleSeeds.map((_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial
              color="#FF4444"
              transparent
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
