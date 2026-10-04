/**
 * Config plugin: signs Android release builds with an upload/release keystore
 * supplied via Gradle properties or environment variables, so the generated
 * `android/` folder never has to be edited by hand.
 *
 *   IMPOSTER_STORE_FILE      absolute path to the .jks keystore
 *   IMPOSTER_STORE_PASSWORD  keystore password
 *   IMPOSTER_KEY_ALIAS       key alias
 *   IMPOSTER_KEY_PASSWORD    key password
 *
 * If they are not provided, release builds fall back to the debug key (and say so).
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// @imposter-release-signing';

const SIGNING_BLOCK = `${MARKER}
android {
    def imposterProp = { String name -> project.findProperty(name) ?: System.getenv(name) }
    def imposterStore = imposterProp('IMPOSTER_STORE_FILE')
    if (imposterStore) {
        signingConfigs {
            imposterRelease {
                storeFile file(imposterStore)
                storePassword imposterProp('IMPOSTER_STORE_PASSWORD')
                keyAlias imposterProp('IMPOSTER_KEY_ALIAS')
                keyPassword imposterProp('IMPOSTER_KEY_PASSWORD')
            }
        }
        buildTypes.release.signingConfig signingConfigs.imposterRelease
    } else {
        logger.warn('Imposter Party: IMPOSTER_STORE_FILE not set - release build is signed with the DEBUG key.')
    }
}
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes(MARKER)) {
      // A second top-level android {} block is merged by Gradle, so this survives template changes.
      contents = `${contents.trimEnd()}\n\n${SIGNING_BLOCK}`;
    }
    cfg.modResults.contents = contents;
    return cfg;
  });
};
