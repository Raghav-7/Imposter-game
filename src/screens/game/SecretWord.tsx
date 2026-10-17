import React, { useMemo, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { FONTS, usePalette } from '../../theme';
import { fitWordSize, formatDisplayWord, splitInitials } from '../../utils/wordDisplay';

type WordSize = 'large' | 'medium' | 'small';

/** Small-letter size limits; each word's capital initial is `ratio` times larger. */
const SIZES: Record<WordSize, { max: number; min: number; ratio: number; lines: number; inset: number }> = {
  // The private role card.
  large: { max: 34, min: 14, ratio: 1.35, lines: 3, inset: 88 },
  // "The word was" after a final guess.
  medium: { max: 28, min: 14, ratio: 1.3, lines: 2, inset: 72 },
  // Answer / result screens, beside the undercover word.
  small: { max: 22, min: 13, ratio: 1.3, lines: 3, inset: 72 },
};

/** Large system fonts may grow the word this much, as long as it still fits. */
const MAX_FONT_SCALE = 1.3;

/**
 * Draws a secret word in Title Case with a larger initial on every word ("Ice Cream" → big I and C,
 * smaller "ce" and "ream"), all on one baseline. The size is fitted to the available width so long
 * words shrink and wrap between words instead of clipping. Display only: `word` is not changed.
 */
export function SecretWord({ word, size = 'large', testID }: { word: string; size?: WordSize; testID?: string }) {
  const p = usePalette();
  const window = useWindowDimensions();
  const spec = SIZES[size];
  const [measured, setMeasured] = useState<number | null>(null);
  const display = useMemo(() => formatDisplayWord(word), [word]);
  const runs = useMemo(() => splitInitials(display), [display]);

  // Until the first layout pass, estimate the width from the window.
  const width = measured ?? Math.max(120, window.width - spec.inset);
  const scale = Math.min(Math.max(window.fontScale || 1, 1), MAX_FONT_SCALE);
  // Fit at the size the user will actually see (system font scaling included)…
  const shown = fitWordSize(runs, {
    width,
    maxSize: spec.max * scale,
    minSize: spec.min,
    ratio: spec.ratio,
    maxLines: spec.lines,
  });
  // …then undo the scaling React Native applies on top.
  const rest = shown / scale;
  const initial = rest * spec.ratio;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && (measured === null || Math.abs(w - measured) > 1)) setMeasured(w);
  };

  return (
    <View style={styles.box} onLayout={onLayout}>
      <Text
        testID={testID}
        accessibilityLabel={display}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[styles.word, { color: p.text, fontSize: rest, lineHeight: Math.ceil(initial * 1.18) }]}
      >
        {runs.map((run, i) =>
          run.initial ? (
            <Text key={i} maxFontSizeMultiplier={MAX_FONT_SCALE} style={{ fontSize: initial }}>
              {run.text}
            </Text>
          ) : (
            run.text
          ),
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%' },
  word: { fontFamily: FONTS.display, textAlign: 'center' },
});
