import { Cloud, Sky, Sparkles, useGLTF } from '@react-three/drei';
import { CuboidCollider, RigidBody, TrimeshCollider } from '@react-three/rapier';
import { Component, Suspense, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';

// ─── Map Constants ───────────────────────────────────────────────

export const MAP_HALF_SIZE = 500;

const SECTOR_SIZE = 250;
const SECTOR_ROWS = 4;
const SECTOR_COLS = 4;

/** Mesh‐name prefixes that get cuboid box colliders */
const COLLISION_PREFIXES = [
  'BUILDING_',
  'WALL_',
  'PROP_HIDE_',
  'PROP_SMALL_',
  'TREE_',
  'LANDMARK_',
];

/** Mesh‐name prefixes that get trimesh ground colliders */
const GROUND_PREFIXES = ['GROUND_', 'ROAD_'];

// ─── Sector Grid ─────────────────────────────────────────────────

interface SectorInfo {
  row: number;
  col: number;
  id: string;
  url: string;
  centerX: number;
  centerZ: number;
}

function buildSectorGrid(): SectorInfo[] {
  const sectors: SectorInfo[] = [];
  for (let r = 0; r < SECTOR_ROWS; r++) {
    for (let c = 0; c < SECTOR_COLS; c++) {
      const minX = -MAP_HALF_SIZE + c * SECTOR_SIZE;
      const maxX = minX + SECTOR_SIZE;
      // Row 0 = north (high Z), row 3 = south (low Z)
      const maxZ = MAP_HALF_SIZE - r * SECTOR_SIZE;
      const minZ = maxZ - SECTOR_SIZE;
      sectors.push({
        row: r,
        col: c,
        id: `sector_r${r}_c${c}`,
        url: `/models/sectors/sector_r${r}_c${c}.glb`,
        centerX: (minX + maxX) / 2,
        centerZ: (minZ + maxZ) / 2,
      });
    }
  }
  return sectors;
}

const SECTOR_GRID = buildSectorGrid();

// ─── Collision helpers ───────────────────────────────────────────

interface ColliderBox {
  position: [number, number, number];
  halfExtents: [number, number, number];
}

interface GroundMeshData {
  vertices: Float32Array;
  indices: Uint32Array;
}

function isPrefix(name: string, prefixes: string[]) {
  for (let i = 0; i < prefixes.length; i++) {
    if (name.startsWith(prefixes[i])) return true;
  }
  return false;
}

/**
 * Walk the original (non‑cloned) scene and extract:
 *  • trimesh data for GROUND_ / ROAD_ meshes   (accurate walkable surface)
 *  • cuboid bounding‑boxes for BUILDING_ / WALL_ / PROP_ / TREE_ / LANDMARK_ meshes
 */
function extractCollisionData(scene: THREE.Group) {
  const grounds: GroundMeshData[] = [];
  const boxes: ColliderBox[] = [];

  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const name = mesh.name;

    if (isPrefix(name, GROUND_PREFIXES)) {
      mesh.updateWorldMatrix(true, false);
      const geo = mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrixWorld);

      const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
      const vertices = new Float32Array(posAttr.array);

      let indices: Uint32Array;
      const indexAttr = geo.getIndex();
      if (indexAttr) {
        indices = new Uint32Array(indexAttr.array);
      } else {
        indices = new Uint32Array(posAttr.count);
        for (let i = 0; i < posAttr.count; i++) indices[i] = i;
      }

      grounds.push({ vertices, indices });
    } else if (isPrefix(name, COLLISION_PREFIXES)) {
      mesh.updateWorldMatrix(true, false);
      const box = new THREE.Box3().setFromObject(mesh);
      if (box.isEmpty()) return;

      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      // Skip degenerate / trivially small meshes
      if (size.x < 0.2 && size.y < 0.2 && size.z < 0.2) return;

      boxes.push({
        position: [center.x, center.y, center.z],
        halfExtents: [
          Math.max(size.x / 2, 0.1),
          Math.max(size.y / 2, 0.1),
          Math.max(size.z / 2, 0.1),
        ],
      });
    }
  });

  return { groundMeshData: grounds, colliderBoxes: boxes };
}

// ─── Error Boundary ──────────────────────────────────────────────

interface EBProps { children: ReactNode; sectorId: string }
interface EBState { hasError: boolean }

class SectorErrorBoundary extends Component<EBProps, EBState> {
  state: EBState = { hasError: false };

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn(`[Map] sector ${this.props.sectorId} failed to load:`, error.message);
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

// ─── Sector Component ────────────────────────────────────────────

function Sector({ info }: { info: SectorInfo }) {
  const { scene } = useGLTF(info.url);

  // Clone the scene for rendering — enables shadows on every mesh
  const clonedScene = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  // Extract physics collision data from the *original* scene
  const { groundMeshData, colliderBoxes } = useMemo(
    () => extractCollisionData(scene),
    [scene],
  );

  return (
    <group>
      {/* ── Visual ── */}
      <primitive object={clonedScene} />

      {/* ── Ground trimesh colliders ── */}
      {groundMeshData.map((data, i) => (
        <RigidBody key={`${info.id}-gnd-${i}`} type="fixed" colliders={false}>
          <TrimeshCollider args={[data.vertices, data.indices]} />
        </RigidBody>
      ))}

      {/* ── Object box colliders ── */}
      {colliderBoxes.length > 0 && (
        <RigidBody type="fixed" colliders={false}>
          {colliderBoxes.map((box, i) => (
            <CuboidCollider
              key={i}
              args={box.halfExtents}
              position={box.position}
            />
          ))}
        </RigidBody>
      )}
    </group>
  );
}

// ─── Fallback Ground ─────────────────────────────────────────────
// Flat green plane so the player can stand even while sectors load.

function FallbackGround() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider
        args={[MAP_HALF_SIZE, 0.5, MAP_HALF_SIZE]}
        position={[0, -0.5, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP_HALF_SIZE * 2, MAP_HALF_SIZE * 2]} />
        <meshStandardMaterial color="#5DAE44" roughness={0.95} />
      </mesh>
    </RigidBody>
  );
}

// ─── Boundary Walls ──────────────────────────────────────────────

function BoundaryWalls() {
  const H = MAP_HALF_SIZE;
  const WALL_H = 15;
  const T = 1.5;

  return (
    <RigidBody type="fixed" colliders={false}>
      {/* North */}
      <CuboidCollider args={[H, WALL_H, T]} position={[0, WALL_H, H]} />
      {/* South */}
      <CuboidCollider args={[H, WALL_H, T]} position={[0, WALL_H, -H]} />
      {/* East */}
      <CuboidCollider args={[T, WALL_H, H]} position={[H, WALL_H, 0]} />
      {/* West */}
      <CuboidCollider args={[T, WALL_H, H]} position={[-H, WALL_H, 0]} />
    </RigidBody>
  );
}

// ─── Mountain Background ─────────────────────────────────────────

function MountainBackground() {
  const mountains = useMemo(() => {
    let state = 2166136261;
    const rng = () => {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      return state / 4294967296;
    };

    const list: { x: number; z: number; s: number; r: number }[] = [];
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const radius = 650 + rng() * 100;
      list.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        s: 50 + rng() * 40,
        r: rng() * Math.PI,
      });
    }
    return list;
  }, []);

  return (
    <group>
      {mountains.map((m, i) => (
        <mesh
          key={i}
          position={[m.x, -15, m.z]}
          rotation={[0, m.r, 0]}
          scale={[m.s, m.s * 1.8, m.s]}
        >
          <coneGeometry args={[1, 1, 4]} />
          <meshBasicMaterial color="#5B8F9A" fog />
        </mesh>
      ))}
    </group>
  );
}

// ─── Lighting ────────────────────────────────────────────────────

function MapLighting() {
  return (
    <>
      <ambientLight intensity={0.25} color="#FFF5E0" />
      <hemisphereLight args={['#FFF1D0', '#5A8F3E', 0.5]} />

      {/* Main sun */}
      <directionalLight
        castShadow
        intensity={1.5}
        color="#FFD080"
        position={[200, 300, 150]}
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.0002}
        shadow-camera-near={10}
        shadow-camera-far={800}
        shadow-camera-left={-400}
        shadow-camera-right={400}
        shadow-camera-top={400}
        shadow-camera-bottom={-400}
      />

      {/* Fill / bounce light */}
      <directionalLight
        intensity={0.3}
        color="#B4D4FF"
        position={[-150, 100, -100]}
      />
    </>
  );
}

// ─── Sky & Atmosphere ────────────────────────────────────────────

function Atmosphere() {
  return (
    <>
      <Sky
        sunPosition={[200, 300, 150]}
        turbidity={0.8}
        rayleigh={0.5}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

      <Sparkles
        count={200}
        scale={[600, 50, 600]}
        size={6}
        speed={0.3}
        opacity={0.35}
        color="#FFD700"
        noise={1}
      />

      <Cloud position={[-120, 80, -180]} opacity={0.15} speed={0.08} scale={[15, 4, 8]} segments={22} color="#FFF6EE" />
      <Cloud position={[60, 95, -50]} opacity={0.2} speed={0.06} scale={[12, 3.5, 7]} segments={20} color="#FFF9F2" />
      <Cloud position={[180, 75, 120]} opacity={0.15} speed={0.07} scale={[14, 4, 9]} segments={22} color="#FFF7EF" />
      <Cloud position={[-220, 100, 150]} opacity={0.12} speed={0.06} scale={[16, 5, 10]} segments={20} color="#FFF5EA" />
      <Cloud position={[10, 88, -250]} opacity={0.18} speed={0.05} scale={[13, 3.5, 8]} segments={18} color="#FFFAF5" />
      <Cloud position={[300, 85, -100]} opacity={0.14} speed={0.04} scale={[18, 5, 11]} segments={24} color="#FFF8F0" />
      <Cloud position={[-350, 92, 0]} opacity={0.13} speed={0.05} scale={[14, 4, 9]} segments={20} color="#FFFBF5" />
    </>
  );
}

// ─── Main GameMap ────────────────────────────────────────────────

export default function GameMap() {
  return (
    <group>
      <MapLighting />
      <Atmosphere />
      <BoundaryWalls />
      <FallbackGround />
      <MountainBackground />

      {/* Sector loading — each sector independently suspends / error‑boundaries */}
      {SECTOR_GRID.map((sector) => (
        <SectorErrorBoundary key={sector.id} sectorId={sector.id}>
          <Suspense fallback={null}>
            <Sector info={sector} />
          </Suspense>
        </SectorErrorBoundary>
      ))}
    </group>
  );
}
