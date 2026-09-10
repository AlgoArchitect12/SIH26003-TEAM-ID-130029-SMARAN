const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Include every storage domain, including native notification and SecureStore preferences.
const excludes = ['root', 'file', 'database', 'sharedpref', 'external',
  'device_root', 'device_file', 'device_database', 'device_sharedpref']
  .map(domain => `    <exclude domain="${domain}" path="."/>`).join('\n');
const rules = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${excludes}
  </cloud-backup>
  <device-transfer>
${excludes}
  </device-transfer>
</data-extraction-rules>
`;

module.exports = function withPrivateBackup(config) {
  config = withAndroidManifest(config, mod => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    application.$['android:fullBackupContent'] = 'false';
    application.$['android:dataExtractionRules'] = '@xml/smaran_data_extraction_rules';
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'smaran_data_extraction_rules.xml'), rules, 'utf8');
    return mod;
  }]);
};
