/**
 * Builds a signed Android release APK (and optionally an AAB) locally.
 *
 *   npm run build:android            # APK  → dist/ImposterParty-<version>.apk
 *   npm run build:android -- --aab   # also AAB for Play Store upload
 *
 * Requires: JDK 17+, Android SDK (ANDROID_HOME / ANDROID_SDK_ROOT, default C:/AndroidSdk),
 * and credentials/signing.properties (see README → "Release signing").
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const android = path.join(root, 'android');
const isWin = process.platform === 'win32';
const wantAab = process.argv.includes('--aab');
const skipPrebuild = process.argv.includes('--no-prebuild');

const sdk =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (isWin ? 'C:/AndroidSdk' : path.join(require('os').homedir(), 'Android', 'Sdk'));
if (!fs.existsSync(sdk)) {
  console.error(`Android SDK not found at ${sdk}. Set ANDROID_HOME.`);
  process.exit(1);
}

const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk, NODE_ENV: 'production' };
const signing = path.join(root, 'credentials', 'signing.properties');
if (fs.existsSync(signing)) {
  for (const line of fs.readFileSync(signing, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  // A relative keystore path is resolved from the project root, so the folder can move drives.
  if (env.IMPOSTER_STORE_FILE && !path.isAbsolute(env.IMPOSTER_STORE_FILE)) {
    env.IMPOSTER_STORE_FILE = path.join(root, env.IMPOSTER_STORE_FILE).replace(/\\/g, '/');
  }
  if (env.IMPOSTER_STORE_FILE && !fs.existsSync(env.IMPOSTER_STORE_FILE)) {
    console.error(`Keystore not found: ${env.IMPOSTER_STORE_FILE} (check credentials/signing.properties).`);
    process.exit(1);
  }
  console.log('Using release keystore from credentials/signing.properties');
} else {
  console.warn('credentials/signing.properties missing — the APK will be signed with the debug key.');
}

const run = (cmd, cwd = root) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, env, stdio: 'inherit' });
};

if (!skipPrebuild) run('npx expo prebuild --platform android --clean --no-install');
// Optional newer CMake/Ninja (CMAKE_DIR). On Windows the SDK's CMake 3.22 ships a Ninja
// that is not long-path aware, which breaks New Architecture codegen builds.
// Falls back to a `.tools/cmake` folder next to the project when CMAKE_DIR isn't set.
let localProps = `sdk.dir=${sdk.replace(/\\/g, '/')}\n`;
const cmakeDir = process.env.CMAKE_DIR || path.join(root, '..', '.tools', 'cmake');
if (cmakeDir && fs.existsSync(cmakeDir)) {
  localProps += `cmake.dir=${cmakeDir.replace(/\\/g, '/')}\n`;
  console.log(`Using CMake from ${cmakeDir}`);
}
fs.writeFileSync(path.join(android, 'local.properties'), localProps);

const gradlew = isWin ? `"${path.join(android, 'gradlew.bat')}"` : './gradlew';
run(`${gradlew} ${wantAab ? 'assembleRelease bundleRelease' : 'assembleRelease'} --no-daemon`, android);

const version = require(path.join(root, 'app.json')).expo.version;
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const apk = path.join(android, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const outApk = path.join(dist, `ImposterParty-${version}.apk`);
fs.copyFileSync(apk, outApk);
console.log(`\nAPK: ${outApk} (${(fs.statSync(outApk).size / 1048576).toFixed(1)} MB)`);
if (wantAab) {
  const aab = path.join(android, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  const outAab = path.join(dist, `ImposterParty-${version}.aab`);
  fs.copyFileSync(aab, outAab);
  console.log(`AAB: ${outAab}`);
}
