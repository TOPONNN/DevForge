import { Html } from '@react-three/drei';
import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../stores/gameStore';

export default function CatchAnimation() {
  const catchAttemptResult = useGameStore((state) => state.catchAttemptResult);
  const clearCatchAttemptResult = useGameStore((state) => state.clearCatchAttemptResult);

  const [visible, setVisible] = useState(false);
  const [shakeCount, setShakeCount] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (!catchAttemptResult) {
      return;
    }
    setShakeCount((1 + Math.floor(Math.random() * 3)) as 1 | 2 | 3);
    setVisible(true);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      clearCatchAttemptResult();
    }, 2000);
    return () => window.clearTimeout(hideTimer);
  }, [catchAttemptResult, clearCatchAttemptResult]);

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
        <div className={`catch-pokeball shake-${shakeCount} ${catchAttemptResult.result}`}>
          <span className="catch-pokeball-top" />
          <span className="catch-pokeball-bottom" />
          <span className="catch-pokeball-band" />
          <span className="catch-pokeball-core" />
        </div>
        <div className={`catch-message ${catchAttemptResult.result}`}>{label}</div>
      </div>
    </Html>
  );
}
