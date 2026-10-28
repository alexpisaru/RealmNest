// The app's version, from package.json: one source for Settings › Information, MCP clientInfo
// and the bridge. tauri.conf.json and Cargo.toml carry the same number without the "-beta" tag
// (Windows file versions are numeric); src/tests/version.test.ts keeps them in step.

import pkg from '../package.json';

export const APP_VERSION: string = pkg.version;

/** how the release is named to people: "0.13.0 Public Beta" */
export const APP_LABEL = APP_VERSION.replace(/-beta$/, ' Public Beta');
