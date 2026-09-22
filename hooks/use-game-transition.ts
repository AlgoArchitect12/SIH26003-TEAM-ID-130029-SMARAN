import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

// One cancellable timer per phase; navigation, backgrounding and Pause suspend it.
export function useGameTransition(delay: number | null, action: () => void, paused = false) {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const latest = useRef(action);
  latest.current = action;
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (delay === null || paused || !focused || !foreground) return;
    const timer = setTimeout(() => latest.current(), delay);
    return () => clearTimeout(timer);
  }, [delay, paused, focused, foreground]);
}
