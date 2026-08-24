#!/usr/bin/env bash

set -Eeuo pipefail

REPOSITORY_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
APP_PATH="$REPOSITORY_ROOT/shiftclock-app"
EXPO_CLI="$APP_PATH/node_modules/.bin/expo"
BUILD_PATH="$REPOSITORY_ROOT/build"
APK_SOURCE="$APP_PATH/android/app/build/outputs/apk/release/app-release.apk"
APK_OUTPUT="$BUILD_PATH/shiftclock-android.apk"

if [[ ! -x "$EXPO_CLI" ]]; then
  printf 'Error: Expo is not installed. Run npm install in %s first.\n' "$APP_PATH" >&2
  exit 1
fi

mkdir -p "$BUILD_PATH/gradle-home" "$BUILD_PATH/android-project-cache"

printf 'Preparing the Android native project...\n'
(
  cd "$APP_PATH"
  "$EXPO_CLI" prebuild --platform android --no-install --no-clean
)

if [[ ! -x "$APP_PATH/android/gradlew" ]]; then
  printf 'Error: Expo did not generate the Android Gradle wrapper.\n' >&2
  exit 1
fi

printf 'Building the Android Release APK...\n'
(
  cd "$APP_PATH/android"
  GRADLE_USER_HOME="$BUILD_PATH/gradle-home" \
    ./gradlew assembleRelease --no-daemon --project-cache-dir "$BUILD_PATH/android-project-cache"
)

if [[ ! -f "$APK_SOURCE" ]]; then
  printf 'Error: Android build completed without producing %s.\n' "$APK_SOURCE" >&2
  exit 1
fi

cp "$APK_SOURCE" "$APK_OUTPUT"
printf 'Android APK: %s\n' "$APK_OUTPUT"
