#!/usr/bin/env bash

set -Eeuo pipefail

FFMPEG="${FFMPEG:-ffmpeg}"
PCM_SAMPLE_RATE=16000
LOUDNESS_TARGET=-16
LOUDNESS_RANGE=11
TRUE_PEAK_TARGET=-1

if (( $# != 1 )); then
  printf 'Usage: %s <audio-file>\n' "${0##*/}" >&2
  exit 1
fi

input_argument="$1"
if [[ ! -f "$input_argument" ]]; then
  printf 'Error: input file does not exist: %s\n' "$input_argument" >&2
  exit 1
fi

if ! command -v "$FFMPEG" >/dev/null 2>&1; then
  printf 'Error: ffmpeg is required but was not found.\n' >&2
  exit 1
fi

input_directory="$(cd -- "$(dirname -- "$input_argument")" && pwd -P)"
input_name="$(basename -- "$input_argument")"
input_path="$input_directory/$input_name"
input_stem="${input_name%.*}"
output_path="$input_directory/$input_stem.h"
if [[ "$output_path" == "$input_path" ]]; then
  printf 'Error: output path would overwrite the input file: %s\n' "$input_path" >&2
  exit 1
fi

symbol_stem="$(
  printf '%s' "$input_stem" |
    LC_ALL=C tr '[:upper:]' '[:lower:]' |
    sed -E 's/[^a-z0-9]+/_/g; s/^_+//; s/_+$//'
)"
if [[ -z "$symbol_stem" ]]; then
  symbol_stem='audio'
elif [[ "$symbol_stem" =~ ^[0-9] ]]; then
  symbol_stem="_$symbol_stem"
fi
symbol_name="${symbol_stem}_alarm"

pcm_temp=''
header_temp=''
cleanup() {
  [[ -z "$pcm_temp" || ! -e "$pcm_temp" ]] || rm -f -- "$pcm_temp"
  [[ -z "$header_temp" || ! -e "$header_temp" ]] || rm -f -- "$header_temp"
}
trap cleanup EXIT HUP INT TERM

pcm_temp="$(mktemp "${TMPDIR:-/tmp}/shiftclock-audio.XXXXXX")"

format_filter="aformat=sample_rates=${PCM_SAMPLE_RATE}:channel_layouts=mono"
analysis_filter="${format_filter},loudnorm=I=${LOUDNESS_TARGET}:LRA=${LOUDNESS_RANGE}:TP=${TRUE_PEAK_TARGET}:print_format=json"

printf 'Measuring loudness...\n'
if ! analysis_output="$("$FFMPEG" \
  -hide_banner \
  -nostats \
  -i "$input_path" \
  -vn -sn -dn \
  -af "$analysis_filter" \
  -f null \
  - 2>&1)"; then
  printf 'Error: ffmpeg could not analyze the input audio.\n%s\n' "$analysis_output" >&2
  exit 1
fi

extract_measurement() {
  local key="$1"
  local value

  value="$(
    printf '%s\n' "$analysis_output" |
      sed -n "s/^[[:space:]]*\"${key}\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p"
  )"
  if [[ ! "$value" =~ ^-?[0-9]+([.][0-9]+)?$ ]]; then
    printf 'Error: ffmpeg returned an invalid %s measurement: %s\n' "$key" "${value:-missing}" >&2
    exit 1
  fi

  printf '%s' "$value"
}

input_i="$(extract_measurement input_i)"
input_tp="$(extract_measurement input_tp)"
input_lra="$(extract_measurement input_lra)"
input_thresh="$(extract_measurement input_thresh)"
target_offset="$(extract_measurement target_offset)"

normalization_filter="${format_filter},loudnorm=I=${LOUDNESS_TARGET}:LRA=${LOUDNESS_RANGE}:TP=${TRUE_PEAK_TARGET}:measured_I=${input_i}:measured_TP=${input_tp}:measured_LRA=${input_lra}:measured_thresh=${input_thresh}:offset=${target_offset}:linear=true"

printf 'Converting to normalized %s Hz mono 16-bit PCM...\n' "$PCM_SAMPLE_RATE"
if ! "$FFMPEG" \
  -hide_banner \
  -loglevel error \
  -y \
  -i "$input_path" \
  -vn -sn -dn \
  -af "$normalization_filter" \
  -ac 1 \
  -ar "$PCM_SAMPLE_RATE" \
  -c:a pcm_s16le \
  -f s16le \
  "$pcm_temp"; then
  printf 'Error: ffmpeg could not convert the input audio.\n' >&2
  exit 1
fi

byte_count="$(wc -c < "$pcm_temp" | tr -d '[:space:]')"
if (( byte_count == 0 || byte_count % 2 != 0 )); then
  printf 'Error: ffmpeg produced invalid 16-bit PCM data.\n' >&2
  exit 1
fi

header_temp="$(mktemp "$input_directory/.audio-to-header.XXXXXX")"
{
  printf '#pragma once\n\n'
  printf '#include <stdint.h>\n\n'
  printf 'const uint8_t %s[] = {\n' "$symbol_name"
  od -An -v -t x1 "$pcm_temp" | awk '
    {
      for (field_index = 1; field_index <= NF; field_index++) {
        if (count == 0) {
          printf "  "
        } else if (count % 12 == 0) {
          printf ",\n  "
        } else {
          printf ", "
        }
        printf "0x%s", $field_index
        count++
      }
    }
    END { printf "\n" }
  '
  printf '};\n\n'
  printf 'const uint32_t %s_len = %s;\n' "$symbol_name" "$byte_count"
} > "$header_temp"

chmod 0644 "$header_temp"
mv -f -- "$header_temp" "$output_path"
header_temp=''

printf 'Created normalized PCM header:\n'
ls -lh -- "$output_path"
