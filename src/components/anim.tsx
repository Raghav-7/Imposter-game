import React, { useEffect, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { useReducedMotion } from '../theme/motion';
import { useAnimatedValue } from '../hooks/useAnimatedValue';

/** Fades + slides children in on mount. Instant when reduced motion is on. */
export function FadeIn({
  children,
  delay = 0,
  duration = 320,
  from = 14,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  from?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const v = useAnimatedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const anim = Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [v, delay, duration, reduced]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Springy scale-in, used for big reveals. */
export function PopIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const v = useAnimatedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 5, tension: 120 }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [v, delay, reduced]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Gentle infinite pulse (e.g. the "pass the phone" icon). */
export function Pulse({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useAnimatedValue(0);
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, reduced]);
  return (
    <Animated.View
      style={[style, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

const CONFETTI = ['🎉', '✨', '🎊', '⭐', '💥', '🎭'];

/** Lightweight emoji burst for winner screens. Skipped entirely with reduced motion. */
export function Confetti({ count = 18, emojis = CONFETTI }: { count?: number; emojis?: string[] }) {
  const reduced = useReducedMotion();
  // Random layout chosen once per mount (lazy initialiser keeps render pure).
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      v: new Animated.Value(0),
      x: (Math.random() - 0.5) * 340,
      y: -160 - Math.random() * 220,
      r: (Math.random() - 0.5) * 720,
      emoji: emojis[i % emojis.length]!,
      delay: Math.random() * 250,
    })),
  );
  useEffect(() => {
    if (reduced) return;
    const anims = pieces.map((p) =>
      Animated.timing(p.v, {
        toValue: 1,
        duration: 1400,
        delay: p.delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    const all = Animated.parallel(anims);
    all.start();
    return () => all.stop();
  }, [pieces, reduced]);
  if (reduced) return null;
  return (
    <>
      {pieces.map((p, i) => (
        <Animated.Text
          key={i}
          pointerEvents="none"
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={{
            position: 'absolute',
            alignSelf: 'center',
            top: '40%',
            fontSize: 26,
            opacity: p.v.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) },
              {
                translateY: p.v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.y, p.y + 260] }),
              },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.r}deg`] }) },
            ],
          }}
        >
          {p.emoji}
        </Animated.Text>
      ))}
    </>
  );
}
