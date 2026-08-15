import { existsSync, readFileSync, statSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
const errors = [];
const versionPattern = /^\d+\.\d+\.\d+$/u;
const releaseTag = process.env.GITHUB_REF_NAME;

if (!versionPattern.test(packageJson.version)) {
	errors.push(`package.json version must be x.y.z: ${packageJson.version}`);
}
if (manifest.version !== packageJson.version) {
	errors.push('manifest.json version does not match package.json.');
}
if (versions[packageJson.version] !== manifest.minAppVersion) {
	errors.push('versions.json does not map the package version to manifest.minAppVersion.');
}
if (releaseTag !== undefined && releaseTag !== packageJson.version) {
	errors.push(`release tag ${releaseTag} does not match package.json version ${packageJson.version}.`);
}
if (manifest.fundingUrl !== 'https://buymeacoffee.com/nyonyataro') {
	errors.push('manifest.json must keep the Buy Me a Coffee fundingUrl.');
}

for (const file of ['main.js', 'manifest.json', 'styles.css']) {
	if (!existsSync(file)) {
		errors.push(`Release asset is missing: ${file}`);
	}
}

if (existsSync('main.js') && statSync('main.js').size >= 200 * 1024) {
	errors.push('main.js must remain below 200 KB.');
}

if (errors.length > 0) {
	console.error(errors.join('\n'));
	process.exitCode = 1;
} else {
	console.log(`Release metadata and assets are ready for ${packageJson.version}.`);
}
