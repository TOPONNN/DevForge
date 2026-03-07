import { useGameStore } from '../stores/gameStore';

export default function Crosshair({ pointerLocked }: { pointerLocked: boolean }) {
  const role = useGameStore((state) => state.role);
  const isCharging = useGameStore((state) => state.isCharging);
  const throwPower = useGameStore((state) => state.throwPower);

  if (role !== 'trainer') {
    return null;
  }

  const size = 18 + throwPower * 26;

  return (
    <div className={`crosshair-layer ${pointerLocked ? 'active' : ''}`}>
      <div className="pokeball-crosshair" style={{ width: `${size}px`, height: `${size}px` }}>
        <span className="pokeball-crosshair-ring" />
        <span
          className="pokeball-crosshair-fill"
          style={{ transform: `scale(${isCharging ? Math.max(0.2, throwPower) : 0.2})` }}
        />
      </div>
    </div>
  );
}
