import { useAppSelector } from '../stores/hooks';

export default function Crosshair({ pointerLocked }: { pointerLocked: boolean }) {
  const role = useAppSelector((state) => state.game.role);
  const isCharging = useAppSelector((state) => state.game.isCharging);
  const throwPower = useAppSelector((state) => state.game.throwPower);

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
