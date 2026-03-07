import { Html } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../stores/gameStore';

/**
 * Text-only overlay for catch result messages.
 * The 3D pokeball animation is handled by CatchAnimation3D.
 */
export default function CatchAnimation() {
  const catchAttemptResult = useGameStore((state) => state.catchAttemptResult);
  const catchAnimPhase = useGameStore((state) => state.catchAnimPhase);
  const catchAnim = useGameStore((state) => state.catchAnim);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!catchAttemptResult) {
      return;
    }
    if (catchAnim && catchAnimPhase !== 'result') {
      return;
    }
    setVisible(true);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
    }, 2500);
    return () => window.clearTimeout(hideTimer);
  }, [catchAttemptResult, catchAnimPhase, catchAnim]);

  const label = useMemo(() => {
    if (!catchAttemptResult) {
      return '';
    }
    if (catchAttemptResult.result === 'caught') {
      return '잡았다!';
    }
    if (catchAttemptResult.result === 'escaped') {
      return '이런! 도망쳤다!';
    }
    return '빗나갔다!';
  }, [catchAttemptResult]);

  if (!visible || !catchAttemptResult) {
    return null;
  }

  return (
    <Html fullscreen>
      <div className="catch-animation-layer">
        <div className={`catch-message ${catchAttemptResult.result}`}>{label}</div>
      </div>
    </Html>
  );
}
