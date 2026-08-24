#!/usr/bin/env bash

set -u

TEST_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)"
FAILURES=0

fail() {
  printf '    %s\n' "$1" >&2
  return 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"

  [[ "$haystack" == *"$needle"* ]] || fail "Expected output to contain: $needle"
}

assert_file() {
  [[ -f "$1" ]] || fail "Expected file: $1"
}

copy_script() {
  local fixture_root="$1"
  local script_name="$2"

  mkdir -p "$fixture_root/tools"
  cp "$TEST_ROOT/tools/$script_name" "$fixture_root/tools/$script_name"
  chmod +x "$fixture_root/tools/$script_name"
}

test_firmware_build_selects_port_and_uses_no_ota_partition() {
  local fixture_root="$1"
  local fake_bin="$fixture_root/fake-bin"
  local command_log="$fixture_root/commands.log"
  local output

  copy_script "$fixture_root" build-firmware.sh || return 1
  mkdir -p "$fake_bin" "$fixture_root/firmware/shiftclock"

  cat > "$fake_bin/arduino-cli" <<'EOF'
#!/usr/bin/env bash
set -eu

printf 'arduino-cli' >> "$TEST_COMMAND_LOG"
printf ' %s' "$@" >> "$TEST_COMMAND_LOG"
printf '\n' >> "$TEST_COMMAND_LOG"

if [[ "${1:-}" == "board" && "${2:-}" == "list" ]]; then
  printf '%s\n' \
    'Port              Protocol Type              Board Name FQBN Core' \
    '/dev/cu.usbmodem1 serial   Serial Port (USB) Unknown' \
    '/dev/cu.usbmodem2 serial   Serial Port (USB) Unknown'
  exit 0
fi

if [[ "${1:-}" == "compile" ]]; then
  build_path=''
  previous=''
  for argument in "$@"; do
    if [[ "$previous" == '--build-path' ]]; then
      build_path="$argument"
      break
    fi
    previous="$argument"
  done
  mkdir -p "$build_path"
  : > "$build_path/shiftclock.ino.bin"
  : > "$build_path/shiftclock.ino.merged.bin"
  : > "$build_path/shiftclock.ino.partitions.bin"
  exit 0
fi

if [[ "${1:-}" == "upload" ]]; then
  exit 0
fi

exit 2
EOF
  chmod +x "$fake_bin/arduino-cli"

  output="$(printf '2\n' | PATH="$fake_bin:$PATH" TEST_COMMAND_LOG="$command_log" "$fixture_root/tools/build-firmware.sh" 2>&1)" || {
    fail "Firmware script failed:\n$output"
    return 1
  }

  assert_contains "$(<"$command_log")" 'esp32:esp32:esp32c3:FlashSize=4M,PartitionScheme=no_ota' || return 1
  assert_contains "$(<"$command_log")" 'upload' || return 1
  assert_contains "$(<"$command_log")" '/dev/cu.usbmodem2' || return 1
  assert_file "$fixture_root/build/firmware/shiftclock.ino.bin" || return 1
  assert_contains "$output" "$fixture_root/build/firmware/shiftclock.ino.bin"
}

test_android_build_copies_and_prints_release_apk() {
  local fixture_root="$1"
  local command_log="$fixture_root/commands.log"
  local expo_cli="$fixture_root/shiftclock-app/node_modules/.bin/expo"
  local output

  copy_script "$fixture_root" build-android.sh || return 1
  mkdir -p "$(dirname -- "$expo_cli")"

  cat > "$expo_cli" <<'EOF'
#!/usr/bin/env bash
set -eu

printf 'expo' >> "$TEST_COMMAND_LOG"
printf ' %q' "$@" >> "$TEST_COMMAND_LOG"
printf '\n' >> "$TEST_COMMAND_LOG"
mkdir -p android
cat > android/gradlew <<'GRADLE'
#!/usr/bin/env bash
set -eu
printf 'gradlew' >> "$TEST_COMMAND_LOG"
printf ' %q' "$@" >> "$TEST_COMMAND_LOG"
printf '\n' >> "$TEST_COMMAND_LOG"
mkdir -p app/build/outputs/apk/release
printf 'release apk' > app/build/outputs/apk/release/app-release.apk
GRADLE
chmod +x android/gradlew
EOF
  chmod +x "$expo_cli"

  output="$(TEST_COMMAND_LOG="$command_log" "$fixture_root/tools/build-android.sh" 2>&1)" || {
    fail "Android script failed:\n$output"
    return 1
  }

  assert_contains "$(<"$command_log")" 'prebuild --platform android --no-install --no-clean' || return 1
  assert_contains "$(<"$command_log")" 'gradlew assembleRelease' || return 1
  assert_file "$fixture_root/build/shiftclock-android.apk" || return 1
  assert_contains "$output" "$fixture_root/build/shiftclock-android.apk"
}

test_ios_build_places_and_prints_release_app() {
  local fixture_root="$1"
  local fake_bin="$fixture_root/fake-bin"
  local command_log="$fixture_root/commands.log"
  local expo_cli="$fixture_root/shiftclock-app/node_modules/.bin/expo"
  local expected_app="$fixture_root/build/ios/Build/Products/Release-iphonesimulator/shiftclockapp.app"
  local output

  copy_script "$fixture_root" build-ios.sh || return 1
  mkdir -p "$fake_bin" "$(dirname -- "$expo_cli")"

  cat > "$expo_cli" <<'EOF'
#!/usr/bin/env bash
set -eu
printf 'expo' >> "$TEST_COMMAND_LOG"
printf ' %q' "$@" >> "$TEST_COMMAND_LOG"
printf '\n' >> "$TEST_COMMAND_LOG"
mkdir -p ios/shiftclockapp.xcworkspace
EOF
  chmod +x "$expo_cli"

  cat > "$fake_bin/uname" <<'EOF'
#!/usr/bin/env bash
printf 'Darwin\n'
EOF
  cat > "$fake_bin/pod" <<'EOF'
#!/usr/bin/env bash
set -eu
printf 'pod' >> "$TEST_COMMAND_LOG"
printf ' %q' "$@" >> "$TEST_COMMAND_LOG"
printf '\n' >> "$TEST_COMMAND_LOG"
EOF
  cat > "$fake_bin/xcodebuild" <<'EOF'
#!/usr/bin/env bash
set -eu
printf 'xcodebuild' >> "$TEST_COMMAND_LOG"
printf ' %q' "$@" >> "$TEST_COMMAND_LOG"
printf '\n' >> "$TEST_COMMAND_LOG"

derived_data=''
previous=''
for argument in "$@"; do
  if [[ "$previous" == '-derivedDataPath' ]]; then
    derived_data="$argument"
    break
  fi
  previous="$argument"
done
mkdir -p "$derived_data/Build/Products/Release-iphonesimulator/shiftclockapp.app"
: > "$derived_data/Build/Products/Release-iphonesimulator/shiftclockapp.app/Info.plist"
EOF
  chmod +x "$fake_bin/uname" "$fake_bin/pod" "$fake_bin/xcodebuild"

  output="$(PATH="$fake_bin:$PATH" TEST_COMMAND_LOG="$command_log" "$fixture_root/tools/build-ios.sh" 2>&1)" || {
    fail "iOS script failed:\n$output"
    return 1
  }

  assert_contains "$(<"$command_log")" 'prebuild --platform ios --no-install --no-clean' || return 1
  assert_contains "$(<"$command_log")" 'pod install' || return 1
  assert_contains "$(<"$command_log")" '-configuration Release' || return 1
  [[ -d "$expected_app" ]] || fail "Expected app bundle: $expected_app" || return 1
  assert_contains "$output" "$expected_app"
}

run_test() {
  local name="$1"
  local test_function="$2"
  local fixture_root

  fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/shiftclock-build-test.XXXXXX")"
  if "$test_function" "$fixture_root"; then
    printf 'ok - %s\n' "$name"
  else
    printf 'not ok - %s\n' "$name"
    FAILURES=$((FAILURES + 1))
  fi
  rm -rf -- "$fixture_root"
}

run_test 'firmware build selects a port and uses 2MB app/2MB SPIFFS' test_firmware_build_selects_port_and_uses_no_ota_partition
run_test 'Android build copies and prints the release APK' test_android_build_copies_and_prints_release_apk
run_test 'iOS build places and prints the Release simulator app' test_ios_build_places_and_prints_release_app

if (( FAILURES > 0 )); then
  printf '%d test(s) failed\n' "$FAILURES" >&2
  exit 1
fi

printf 'All build script tests passed\n'
