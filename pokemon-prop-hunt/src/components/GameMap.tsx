import { CuboidCollider, RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { ENVIRONMENT_PROPS, type EnvironmentProp } from './props';

function EnvironmentObject({ prop }: { prop: EnvironmentProp }) {
  if (prop.type === 'tree') {
    return (
      <RigidBody type="fixed" colliders={false} position={prop.position} rotation={[0, prop.rotationY, 0]}>
        <CuboidCollider args={[prop.size[0] * 0.5, prop.size[1] * 0.5, prop.size[2] * 0.5]} />
        <mesh castShadow position={[0, 0, 0]}>
          <cylinderGeometry args={[prop.size[0] * 0.35, prop.size[0] * 0.45, prop.size[1], 16]} />
          <meshStandardMaterial color={prop.color} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, prop.size[1] * 0.72, 0]}>
          <sphereGeometry args={[prop.size[1] * 0.45, 18, 18]} />
          <meshStandardMaterial color="#5BAE4A" roughness={0.6} />
        </mesh>
      </RigidBody>
    );
  }

  if (prop.type === 'berry_bush') {
    return (
      <RigidBody type="fixed" colliders={false} position={prop.position} rotation={[0, prop.rotationY, 0]}>
        <CuboidCollider args={[prop.size[0] * 0.5, prop.size[1] * 0.5, prop.size[2] * 0.5]} />
        <mesh castShadow>
          <sphereGeometry args={[prop.size[0] * 0.45, 16, 16]} />
          <meshStandardMaterial color={prop.color} roughness={0.55} />
        </mesh>
        {[-0.25, 0, 0.22].map((x, index) => (
          <mesh key={`${prop.id}-${index}`} position={[x, 0.2, index === 1 ? 0.23 : -0.2]} castShadow>
            <sphereGeometry args={[0.1, 12, 12]} />
            <meshStandardMaterial color={index === 1 ? '#E63946' : '#C1121F'} />
          </mesh>
        ))}
      </RigidBody>
    );
  }

  if (prop.type === 'rock') {
    return (
      <RigidBody type="fixed" colliders={false} position={prop.position} rotation={[0, prop.rotationY, 0]}>
        <CuboidCollider args={[prop.size[0] * 0.5, prop.size[1] * 0.5, prop.size[2] * 0.5]} />
        <mesh castShadow>
          <boxGeometry args={prop.size} />
          <meshStandardMaterial color={prop.color} roughness={0.95} />
        </mesh>
      </RigidBody>
    );
  }

  if (prop.type === 'building') {
    return (
      <RigidBody type="fixed" colliders={false} position={prop.position} rotation={[0, prop.rotationY, 0]}>
        <CuboidCollider args={[prop.size[0] * 0.5, prop.size[1] * 0.5, prop.size[2] * 0.5]} />
        <mesh castShadow receiveShadow>
          <boxGeometry args={prop.size} />
          <meshStandardMaterial color={prop.color} roughness={0.6} />
        </mesh>
        <mesh castShadow position={[0, prop.size[1] * 0.58, 0]}>
          <boxGeometry args={[prop.size[0] * 1.1, prop.size[1] * 0.22, prop.size[2] * 1.1]} />
          <meshStandardMaterial color="#F8F9FA" roughness={0.45} />
        </mesh>
      </RigidBody>
    );
  }

  if (prop.type === 'road') {
    return (
      <mesh position={prop.position} rotation={[0, prop.rotationY, 0]} receiveShadow>
        <boxGeometry args={prop.size} />
        <meshStandardMaterial color={prop.color} roughness={0.92} metalness={0.02} />
      </mesh>
    );
  }

  return (
    <RigidBody type="fixed" colliders={false} position={prop.position} rotation={[0, prop.rotationY, 0]}>
      <CuboidCollider args={[prop.size[0] * 0.5, prop.size[1] * 0.5, prop.size[2] * 0.5]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={prop.size} />
        <meshStandardMaterial color={prop.color} roughness={prop.type === 'tall_grass' ? 0.75 : 0.82} />
      </mesh>
    </RigidBody>
  );
}

export default function GameMap() {
  return (
    <group>
      <hemisphereLight args={['#C9F2FF', '#87B957', 0.72]} />
      <directionalLight
        castShadow
        intensity={1.35}
        color="#FFE8A3"
        position={[40, 50, 20]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00015}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      />

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[80, 0.25, 80]} position={[0, -0.25, 0]} />
        <mesh receiveShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[160, 0.5, 160]} />
          <meshStandardMaterial color="#67C25E" roughness={0.88} metalness={0.02} />
        </mesh>
      </RigidBody>

      <mesh position={[0, 22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[400, 64]} />
        <meshBasicMaterial color="#A9E6FF" side={THREE.DoubleSide} />
      </mesh>

      <group>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[3.6, 1.7, 2.3]} position={[0, 1.7, -1.5]} />
          <mesh position={[0, 1.7, -1.5]} castShadow receiveShadow>
            <boxGeometry args={[7.2, 3.4, 4.6]} />
            <meshStandardMaterial color="#FF8787" roughness={0.65} />
          </mesh>
          <mesh position={[0, 3.65, -1.5]} castShadow>
            <boxGeometry args={[8, 0.7, 5.2]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
          </mesh>
          <mesh position={[0, 2.45, 0.85]}>
            <boxGeometry args={[1.8, 1.4, 0.2]} />
            <meshStandardMaterial color="#E63946" emissive="#E63946" emissiveIntensity={0.16} />
          </mesh>
        </RigidBody>
      </group>

      {ENVIRONMENT_PROPS.map((prop) => (
        <EnvironmentObject key={prop.id} prop={prop} />
      ))}
    </group>
  );
}
