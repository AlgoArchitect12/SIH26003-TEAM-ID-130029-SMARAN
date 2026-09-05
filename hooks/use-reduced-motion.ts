import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useOnboardingStore } from '@/src/stores/onboarding.store';

export type ReducedMotionOverride = boolean | null;

export function useReducedMotion(override: ReducedMotionOverride = null) {
  const preferred = useOnboardingStore((state) => state.accessibility.reducedMotion);
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

  return override === true || preferred || isEnabledBySystem;
}
