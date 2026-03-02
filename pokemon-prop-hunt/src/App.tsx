import { useEffect, useRef, useState } from 'react';
import Crosshair from './components/Crosshair';
import GameScene from './components/GameScene';
import HUD from './components/HUD';
import LobbyScreen from './components/LobbyScreen';
import ResultScreen from './components/ResultScreen';
import { useKeyboard } from './hooks/useKeyboard';
import { useGameStore } from './stores/gameStore';
import { soundManager } from './systems/sound';

function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const keysRef = useKeyboard();
  const [pointerLocked, setPointerLocked] = useState(false);

  const phase = useGameStore((state) => state.phase);
  const timeLeft = useGameStore((state) => state.timeLeft);
  const prepTime = useGameStore((state) => state.prepTime);
  const huntTime = useGameStore((state) => state.huntTime);
  const setPhase = useGameStore((state) => state.setPhase);
  const setTimeLeft = useGameStore((state) => state.setTimeLeft);
  const tickTimer = useGameStore((state) => state.tickTimer);

  useEffect(() => {
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === containerRef.current;
      setPointerLocked(locked);
      document.body.classList.toggle('pointer-locked', locked);
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.body.classList.remove('pointer-locked');
    };
  }, []);

  useEffect(() => {
    if (phase !== 'preparing' && phase !== 'hunting') {
      return;
    }
    const timer = window.setInterval(() => {
      tickTimer();
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, tickTimer]);

  useEffect(() => {
    if (phase === 'preparing' && timeLeft <= 0) {
      setPhase('hunting');
      setTimeLeft(huntTime);
      soundManager.play('round_start');
      return;
    }
    if (phase === 'hunting' && timeLeft <= 0) {
      setPhase('ended');
      soundManager.play('round_end');
    }
  }, [huntTime, phase, setPhase, setTimeLeft, timeLeft]);

  const requestPointerLock = () => {
    if (phase === 'lobby' || phase === 'selecting') {
      return;
    }
    containerRef.current?.requestPointerLock();
  };

  const restartRound = () => {
    setPhase('preparing');
    setTimeLeft(prepTime);
    useGameStore.getState().resetRound();
  };

  return (
    <div className="app-root" ref={containerRef}>
      <LobbyScreen />
      <GameScene keysRef={keysRef} pointerLocked={pointerLocked} />
      <HUD pointerLocked={pointerLocked} />
      <Crosshair pointerLocked={pointerLocked} />

       {(phase === 'preparing' || phase === 'hunting') && !pointerLocked ? (
         <div className="click-to-play" role="button" tabIndex={0} onClick={requestPointerLock}>
           <div className="click-title">클릭하여 게임 입장</div>
           <div className="click-subtitle">WASD 이동 • Shift 달리기 • Space 점프/회피 • 좌클릭 꾹 눌러 던지기</div>
         </div>
       ) : null}

      {phase === 'ended' ? <ResultScreen onPlayAgain={restartRound} /> : null}
    </div>
  );
}

export default App;
