import { render, screen, within } from '@testing-library/react-native';
import { type StyleProp, StyleSheet, type TextStyle } from 'react-native';

import { WORD_BANK } from '../../src/data/words';
import { SecretWord } from '../../src/screens/game/SecretWord';
import { fitWordSize, formatDisplayWord, splitInitials } from '../../src/utils/wordDisplay';

const fontSizeOf = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as StyleProp<TextStyle>)?.fontSize as number;

describe('formatDisplayWord (display only)', () => {
  it.each([
    ['Pizza', 'Pizza'],
    ['PIZZA', 'Pizza'],
    ['CRICKET', 'Cricket'],
    ['ICE CREAM', 'Ice Cream'],
    ['NEW YORK', 'New York'],
    ['ice cream', 'Ice Cream'],
    ['Ice cream', 'Ice Cream'],
    ['going to the gym', 'Going to the Gym'],
    ['spider-man', 'Spider-Man'],
    ["don't stop", "Don't Stop"],
    // Deliberate casing is never "fixed".
    ['Back to the Future', 'Back to the Future'],
    ['Leonardo da Vinci', 'Leonardo da Vinci'],
    ['iPhone', 'iPhone'],
    ["McDonald's", "McDonald's"],
    ['MS Dhoni', 'MS Dhoni'],
    ['KFC', 'KFC'],
    ['IPL', 'IPL'],
    ['WALL-E', 'WALL-E'],
    ['E.T.', 'E.T.'],
    ['T20', 'T20'],
    ['3 Idiots', '3 Idiots'],
    ['A. R. Rahman', 'A. R. Rahman'],
    ['TV REMOTE', 'TV Remote'],
    ['TO KILL A MOCKINGBIRD', 'To Kill a Mockingbird'],
    // No capitals in the script: unchanged.
    ['प्रिया', 'प्रिया'],
    ['பொங்கல்', 'பொங்கல்'],
    ['96', '96'],
  ])('%s → %s', (input, expected) => {
    expect(formatDisplayWord(input)).toBe(expected);
  });

  it('keeps every built-in word exactly as written, apart from case', () => {
    for (const words of Object.values(WORD_BANK)) {
      for (const w of words) {
        const shown = formatDisplayWord(w.word);
        expect(shown.toLowerCase()).toBe(w.word.toLowerCase());
        expect(shown.length).toBe(w.word.length);
      }
    }
  });
});

describe('splitInitials', () => {
  it('marks the capital starting each word', () => {
    expect(splitInitials('Pizza')).toEqual([
      { text: 'P', initial: true },
      { text: 'izza', initial: false },
    ]);
    expect(splitInitials('Ice Cream')).toEqual([
      { text: 'I', initial: true },
      { text: 'ce ', initial: false },
      { text: 'C', initial: true },
      { text: 'ream', initial: false },
    ]);
  });

  it('skips small lowercase words and mid-word capitals; handles hyphens and accents', () => {
    const initials = (s: string) =>
      splitInitials(s)
        .filter((r) => r.initial)
        .map((r) => r.text);
    expect(initials('Back to the Future')).toEqual(['B', 'F']);
    expect(initials("McDonald's")).toEqual(['M']);
    expect(initials('Spider-Man')).toEqual(['S', 'M']);
    expect(initials('Élan Vital')).toEqual(['É', 'V']); // accent stays with its letter
    expect(initials('प्रिया')).toEqual([]); // never splits an Indic cluster
  });

  it('runs always join back to the exact display text', () => {
    for (const s of ['Ice Cream', 'A. R. Rahman', 'Taarak Mehta Ka Ooltah Chashmah', '😎 Party Time', '']) {
      expect(
        splitInitials(s)
          .map((r) => r.text)
          .join(''),
      ).toBe(s);
    }
  });
});

describe('fitWordSize', () => {
  const opts = { width: 272, maxSize: 34, minSize: 14, ratio: 1.35, maxLines: 3 };
  const fit = (w: string, o = opts) => fitWordSize(splitInitials(formatDisplayWord(w)), o);

  it('short words use the full size; long ones shrink; never below the minimum', () => {
    expect(fit('Pizza')).toBe(34);
    expect(fit('Thondimuthalum Driksakshiyum')).toBeLessThan(34);
    const huge = fit('Supercalifragilisticexpialidocious');
    expect(huge).toBeLessThan(20);
    expect(huge).toBeGreaterThanOrEqual(14);
    expect(fit('x'.repeat(40))).toBe(14);
  });

  it('narrower screens get smaller text for long words', () => {
    const wide = fit('Vinnaithaandi Varuvaayaa', { ...opts, width: 400 });
    const narrow = fit('Vinnaithaandi Varuvaayaa', { ...opts, width: 220 });
    expect(narrow).toBeLessThan(wide);
  });
});

const fitAt = (width: number) => ({ width, maxSize: 34, minSize: 14, ratio: 1.35, maxLines: 3 });

describe('<SecretWord />', () => {
  // react-native's index reads this module on every call, so spying on it reaches the component.
  const dims = (width: number, fontScale = 1) =>
    jest
      .spyOn(jest.requireActual('react-native/Libraries/Utilities/useWindowDimensions'), 'default')
      .mockReturnValue({ width, height: 800, scale: 2, fontScale });

  afterEach(() => jest.restoreAllMocks());

  it('"Pizza": big P, smaller "izza"; the label reads the whole word', async () => {
    dims(393);
    await render(<SecretWord word="PIZZA" testID="w" />);
    const word = screen.getByTestId('w');
    expect(word.props.accessibilityLabel).toBe('Pizza');
    const p = within(word).getByText('P');
    expect(fontSizeOf(p)).toBeCloseTo(fontSizeOf(word) * 1.35);
    // Line height leaves room for the big initials, so lines never overlap.
    expect(StyleSheet.flatten(word.props.style).lineHeight).toBeGreaterThanOrEqual(fontSizeOf(p));
  });

  it('long words on a small phone shrink to fit and are never limited to a number of lines', async () => {
    dims(320);
    await render(<SecretWord word="Taarak Mehta Ka Ooltah Chashmah" testID="w" />);
    const word = screen.getByTestId('w');
    expect(word.props.numberOfLines).toBeUndefined(); // wraps instead of clipping
    expect(fontSizeOf(word)).toBeLessThanOrEqual(34);
    expect(fontSizeOf(word)).toBeGreaterThanOrEqual(14);
  });

  it('large system fonts make short words bigger (up to the cap)', async () => {
    dims(393, 1);
    const { unmount } = await render(<SecretWord word="Pizza" testID="w" />);
    expect(fontSizeOf(screen.getByTestId('w'))).toBe(34);
    await unmount();
    dims(393, 2);
    await render(<SecretWord word="Pizza" testID="w" />);
    // RN multiplies by min(2, 1.3): the user sees 44px small letters, well within the width.
    expect(fontSizeOf(screen.getByTestId('w')) * 1.3).toBeCloseTo(44, 0);
  });

  it('large system fonts: the size is compensated so the scaled text still fits', async () => {
    dims(360, 1);
    const { unmount } = await render(<SecretWord word="Thondimuthalum" testID="w" />);
    const normal = fontSizeOf(screen.getByTestId('w'));
    await unmount();
    dims(360, 2);
    await render(<SecretWord word="Thondimuthalum" testID="w" />);
    const word = screen.getByTestId('w');
    expect(word.props.maxFontSizeMultiplier).toBe(1.3);
    // Short of the width limit the word grows with the system font; what the user sees
    // (size × capped scale) never exceeds what fits the width.
    const shown = fontSizeOf(word) * 1.3;
    expect(shown).toBeGreaterThanOrEqual(normal - 0.01);
    expect(shown).toBeLessThanOrEqual(
      fitWordSize(splitInitials('Thondimuthalum'), { ...fitAt(360 - 88), maxSize: 99 }) + 0.5,
    );
  });
});
