# Preparing and publishing Amber

Run these commands from the repository root using Node.js 22 or later. Release artifacts and the isolated consumer are stored in `.release/`, which is ignored by Git.

## Validate the release

```sh
npm ci
npx playwright install chromium firefox webkit
npm test
npm run test:types
npm run test:browser
npm run size
```

`test:types` builds both distributions and checks NodeNext, Bundler, and standalone Motion declarations without its optional Scroll peer. The browser suites cover Chromium, Firefox, and WebKit. Four CDP hardware-touch cases are intentionally Chromium-only; synthetic touch coverage runs across all three engines.

Run the full checks once for the release candidate. After a correction, rerun failures and any checks affected by that correction. Changing production source requires rebuilding and replacing the affected tarball.

## Pack the verified distributions

Both package versions are currently `1.0.0`; Motion's optional Scroll peer is `^1.0.0`. Update versions and the lockfile together for subsequent releases. Never reuse an already published npm version.

```sh
mkdir -p .release
npm pack --workspace=amber-scroll --ignore-scripts --cache .release/npm-cache --pack-destination .release --json > .release/scroll-pack.json
npm pack --workspace=amber-motion --ignore-scripts --cache .release/npm-cache --pack-destination .release --json > .release/motion-pack.json
```

Here `--ignore-scripts` avoids rebuilding distributions already built and validated above. A normal source-package `npm pack` or `npm publish` runs each package's `prepack` build and size check instead.

Each archive includes only its manifest, README, error-code reference, MIT license, and distribution files (JavaScript, source maps, and declarations). Production error codes preserve validation and exception classes; source imports retain descriptive messages. Applications should not depend on exact exception-message text.

## Publish the exact verified archives

Publishing is a separate release action. Verify the npm account, package-name permission, version availability, and any required two-factor authentication first. A registry 404 does not reserve a name or guarantee publishing permission.

```sh
npm whoami
npm publish .release/amber-scroll-1.0.0.tgz --access public
npm publish .release/amber-motion-1.0.0.tgz --access public
```

Publish Scroll first, then Motion. Retain the pack manifests and verification report with the release. After successful publication, verify both registry versions before creating a release tag.
