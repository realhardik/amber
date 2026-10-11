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
mkdir -p .release/consumer
npm pack --workspace=amber-scroll --ignore-scripts --cache .release/npm-cache --pack-destination .release --json > .release/scroll-pack.json
npm pack --workspace=amber-motion --ignore-scripts --cache .release/npm-cache --pack-destination .release --json > .release/motion-pack.json
```

Here `--ignore-scripts` avoids rebuilding distributions already built and validated above. A normal source-package `npm pack` or `npm publish` runs each package's `prepack` build and size check instead.

Each archive includes only its manifest, README, error-code reference, MIT license, and distribution files (JavaScript, source maps, and declarations). Production error codes preserve validation and exception classes; source imports retain descriptive messages. Applications should not depend on exact exception-message text.

## Smoke-test the archives in an Angular consumer

Create an isolated consumer, install the tarballs, and install the framework used by the smoke fixture. These dependencies do not enter either published package or the repository's runtime dependencies.

```sh
node --input-type=module -e 'import { writeFileSync } from "node:fs"; writeFileSync(".release/consumer/package.json", JSON.stringify({name:"amber-release-consumer",private:true,type:"module"}));'
npm install --prefix .release/consumer --ignore-scripts --no-audit --no-fund @angular/core@21.2.25 @angular/common@21.2.25 @angular/compiler@21.2.25 @angular/platform-browser@21.2.25 @angular/router@21.2.25 rxjs@7
npm install --prefix .release/consumer --ignore-scripts --no-audit --no-fund "$PWD/.release/amber-scroll-1.0.0.tgz" "$PWD/.release/amber-motion-1.0.0.tgz"
npm run test:release
```

The JIT Angular fixture uses the installed archives, not repository source. It checks all public exports and declarations, then checks nested-route fragment navigation with `<base href="/">`, Back restoration, Motion binding, SVG animation, and route teardown/remount in all three browsers. Results are written to `.release/smoke-report.json`. This validates Angular 21.2.25; it is not a claim of testing every framework version or device.

The fixture follows Angular's [standalone bootstrap API](https://angular.dev/api/platform-browser/bootstrapApplication) and [zoneless provider API](https://angular.dev/api/core/provideZonelessChangeDetection).

## Publish the exact verified archives

Publishing is a separate release action. Verify the npm account, package-name permission, version availability, and any required two-factor authentication first. A registry 404 does not reserve a name or guarantee publishing permission.

```sh
npm whoami
npm publish .release/amber-scroll-1.0.0.tgz --access public
npm publish .release/amber-motion-1.0.0.tgz --access public
```

Publish Scroll first, then Motion. Retain the pack manifests and verification report with the release. After successful publication, verify both registry versions before creating a release tag.
