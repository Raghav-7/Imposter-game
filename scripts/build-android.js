/**
 * Builds a signed Android release APK (and optionally an AAB) locally.
 *
 *   npm run build:android            # APK  → dist/ImposterParty-<version>.apk
 *   npm run build:android -- --aab   # also AAB for Play Store upload
 *
 * Before an update, raise "version" and "android.versionCode" in app.json: Android only installs
 * an update over an existing install when the versionCode is higher and the signing key is the
 * same. The built APK's real version and signer are checked and printed before it is copied.
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

const expo = require(path.join(root, 'app.json')).expo;
const version = expo.version;
const versionCode = expo.android.versionCode;

// With --no-prebuild the generated android/ project is reused as is; it must already carry this
// version, or the APK would be named for one version while containing another.
if (skipPrebuild) {
  const gradle = fs.readFileSync(path.join(android, 'app', 'build.gradle'), 'utf8');
  const code = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
  const name = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
  if (code !== versionCode || name !== version) {
    console.error(
      `android/ is stale (versionCode ${code}, versionName ${name}) but app.json says ${versionCode} / ${version}. Run without --no-prebuild.`,
    );
    process.exit(1);
  }
}

/** Newest Android SDK build-tool with this name (aapt, apksigner), or null. */
function buildTool(name) {
  const dir = path.join(sdk, 'build-tools');
  if (!fs.existsSync(dir)) return null;
  const versions = fs.readdirSync(dir).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  for (const v of versions) {
    for (const file of isWin ? [`${name}.exe`, `${name}.bat`] : [name]) {
      const full = path.join(dir, v, file);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

/** Refuses to publish an APK whose real version differs from app.json; prints its signer. */
function checkApk(apk) {
  const aapt = buildTool('aapt');
  if (!aapt) {
    console.warn('aapt not found — skipping the APK version check.');
    return;
  }
  const badging = execSync(`"${aapt}" dump badging "${apk}"`, { env }).toString();
  const m = badging.match(/package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/);
  if (!m || Number(m[2]) !== versionCode || m[3] !== version) {
    const found = m ? `${m[1]} ${m[3]} (versionCode ${m[2]})` : 'unreadable';
    console.error(`Built APK is ${found}, expected ${version} (versionCode ${versionCode}).`);
    process.exit(1);
  }
  console.log(`\nPackage ${m[1]} · version ${m[3]} · versionCode ${m[2]}`);
  const apksigner = buildTool('apksigner');
  if (apksigner) {
    const certs = execSync(`"${apksigner}" verify --print-certs "${apk}"`, { env }).toString();
    const sha = certs.match(/certificate SHA-256 digest: ([0-9a-f]+)/)?.[1];
    // Updates install only over an app signed with this same certificate.
    console.log(`Signer SHA-256: ${sha ?? 'unknown'}`);
  }
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

const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const apk = path.join(android, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
checkApk(apk);
const outApk = path.join(dist, `ImposterParty-${version}.apk`);
fs.copyFileSync(apk, outApk);
console.log(`\nAPK: ${outApk} (${(fs.statSync(outApk).size / 1048576).toFixed(1)} MB)`);
if (wantAab) {
  const aab = path.join(android, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  const outAab = path.join(dist, `ImposterParty-${version}.aab`);
  fs.copyFileSync(aab, outAab);
  console.log(`AAB: ${outAab}`);
}
