import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export type ReducedMotionOverride = boolean | null;

export function useReducedMotion(override: ReducedMotionOverride = null) {
  const [isEnabledBySystem, setIsEnabledBySystem] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setIsEnabledBySystem);

    AccessibilityInfo.isReduceMotionEnabled()
      .then((isEnabled) => {
        if (isMounted) {
          setIsEnabledBySystem(isEnabled);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return override ?? isEnabledBySystem;
}
