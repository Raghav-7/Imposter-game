import { useState } from 'react';
import { Animated } from 'react-native';

/** Stable Animated.Value for the component's lifetime (react-native-web lacks RN's built-in hook). */
export function useAnimatedValue(initial: number): Animated.Value {
  const [value] = useState(() => new Animated.Value(initial));
  return value;
}
