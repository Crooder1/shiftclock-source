#!/usr/bin/env bash

set -Eeuo pipefail

REPOSITORY_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
APP_PATH="$REPOSITORY_ROOT/shiftclock-app"
EXPO_CLI="$APP_PATH/node_modules/.bin/expo"
BUILD_PATH="$REPOSITORY_ROOT/build/ios"

if [[ "$(uname -s)" != 'Darwin' ]]; then
  printf 'Error: building the iOS app requires macOS and Xcode.\n' >&2
  exit 1
fi

if [[ ! -x "$EXPO_CLI" ]]; then
  printf 'Error: Expo is not installed. Run npm install in %s first.\n' "$APP_PATH" >&2
  exit 1
fi

for required_command in pod xcodebuild; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    printf 'Error: %s is required but was not found.\n' "$required_command" >&2
    exit 1
  fi
done

mkdir -p "$BUILD_PATH"

printf 'Preparing the iOS native project...\n'
(
  cd "$APP_PATH"
  "$EXPO_CLI" prebuild --platform ios --no-install --no-clean
)

printf 'Installing iOS pods...\n'
pod install --project-directory="$APP_PATH/ios"

shopt -s nullglob
workspaces=("$APP_PATH"/ios/*.xcworkspace)
shopt -u nullglob

if (( ${#workspaces[@]} == 0 )); then
  printf 'Error: Expo did not generate an Xcode workspace.\n' >&2
  exit 1
fi

workspace="${workspaces[0]}"
scheme="$(basename -- "$workspace" .xcworkspace)"

printf 'Building the iOS Release simulator app...\n'
xcodebuild \
  -workspace "$workspace" \
  -scheme "$scheme" \
  -configuration Release \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$BUILD_PATH" \
  CODE_SIGNING_ALLOWED=NO \
  build

app_bundle="$BUILD_PATH/Build/Products/Release-iphonesimulator/$scheme.app"
if [[ ! -d "$app_bundle" ]]; then
  app_bundle="$(find "$BUILD_PATH/Build/Products/Release-iphonesimulator" -type d -name '*.app' -print -quit 2>/dev/null || true)"
fi

if [[ -z "$app_bundle" || ! -d "$app_bundle" ]]; then
  printf 'Error: iOS build completed without producing a Release simulator app.\n' >&2
  exit 1
fi

printf 'iOS app: %s\n' "$app_bundle"
