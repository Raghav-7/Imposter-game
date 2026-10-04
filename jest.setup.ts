/* Global test setup: in-memory AsyncStorage and silent native audio. */
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-audio', () => {
  const player = () => ({
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    remove: jest.fn(),
    playing: false,
    loop: false,
    volume: 1,
  });
  return {
    createAudioPlayer: jest.fn(player),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  };
});
