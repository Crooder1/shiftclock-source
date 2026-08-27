#!/usr/bin/env bash

set -Eeuo pipefail

REPOSITORY_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
SKETCH_PATH="$REPOSITORY_ROOT/firmware/shiftclock"
BUILD_PATH="$REPOSITORY_ROOT/build/firmware"
ARDUINO_CLI="${ARDUINO_CLI:-arduino-cli}"
UPLOAD_SPEED='921600'

if (( $# > 0 )); then
  if [[ "${1:-}" != '--upload-speed' ]] || (( $# != 2 )); then
    printf 'Usage: %s [--upload-speed <baud>]\n' "${0##*/}" >&2
    exit 2
  fi
  UPLOAD_SPEED="$2"
fi

case "$UPLOAD_SPEED" in
  921600|460800|230400|115200) ;;
  *)
    printf 'Error: unsupported upload speed: %s\n' "$UPLOAD_SPEED" >&2
    printf 'Supported upload speeds: 921600, 460800, 230400, 115200\n' >&2
    exit 2
    ;;
esac

FQBN="esp32:esp32:esp32c3:FlashSize=4M,PartitionScheme=no_ota,UploadSpeed=$UPLOAD_SPEED"

if ! command -v "$ARDUINO_CLI" >/dev/null 2>&1; then
  printf 'Error: arduino-cli is required but was not found.\n' >&2
  exit 1
fi

board_list="$("$ARDUINO_CLI" board list)" || {
  printf 'Error: unable to list connected Arduino ports.\n' >&2
  exit 1
}

ports=()
while IFS= read -r port; do
  [[ -n "$port" ]] && ports+=("$port")
done < <(printf '%s\n' "$board_list" | awk 'NR > 1 && $2 == "serial" { print $1 }')

if (( ${#ports[@]} == 0 )); then
  printf 'Error: no active serial ports were found.\n' >&2
  exit 1
fi

printf 'Active serial ports:\n'
for index in "${!ports[@]}"; do
  printf '  %d) %s\n' "$((index + 1))" "${ports[$index]}"
done

printf 'Select a port [1-%d]: ' "${#ports[@]}"
IFS= read -r selection

if [[ ! "$selection" =~ ^[0-9]+$ ]] || (( selection < 1 || selection > ${#ports[@]} )); then
  printf 'Error: invalid port selection: %s\n' "$selection" >&2
  exit 1
fi

selected_port="${ports[$((selection - 1))]}"
mkdir -p "$BUILD_PATH"

printf 'Building firmware with the 4MB flash / 2MB app / 2MB SPIFFS layout...\n'
"$ARDUINO_CLI" compile \
  --clean \
  --fqbn "$FQBN" \
  --build-path "$BUILD_PATH" \
  "$SKETCH_PATH"

printf 'Uploading firmware to %s...\n' "$selected_port"
"$ARDUINO_CLI" upload \
  --fqbn "$FQBN" \
  --port "$selected_port" \
  --input-dir "$BUILD_PATH" \
  "$SKETCH_PATH"

printf 'Firmware output files:\n'
find "$BUILD_PATH" -type f \( -name '*.bin' -o -name '*.elf' -o -name '*.map' \) -print | sort
