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

copy_converter() {
  local fixture_root="$1"

  mkdir -p "$fixture_root/tools"
  cp "$TEST_ROOT/tools/audio-to-header.sh" "$fixture_root/tools/audio-to-header.sh" || return 1
  chmod +x "$fixture_root/tools/audio-to-header.sh"
}

install_fake_ffmpeg() {
  local fixture_root="$1"
  local fake_bin="$fixture_root/fake-bin"

  mkdir -p "$fake_bin"
  cat > "$fake_bin/ffmpeg" <<'EOF'
#!/usr/bin/env bash
set -eu

printf 'ffmpeg' >> "$TEST_COMMAND_LOG"
printf ' %q' "$@" >> "$TEST_COMMAND_LOG"
printf '\n' >> "$TEST_COMMAND_LOG"

if [[ " $* " == *" -f null - "* ]]; then
  cat >&2 <<'JSON'
{
  "input_i" : "-24.00",
  "input_tp" : "-5.00",
  "input_lra" : "2.00",
  "input_thresh" : "-34.00",
  "output_i" : "-16.00",
  "output_tp" : "-1.00",
  "output_lra" : "2.00",
  "output_thresh" : "-26.00",
  "normalization_type" : "linear",
  "target_offset" : "0.25"
}
JSON
  exit 0
fi

output_path=''
for argument in "$@"; do
  output_path="$argument"
done
printf '\x00\x80\xff\x7f' > "$output_path"
EOF
  chmod +x "$fake_bin/ffmpeg"
}

test_writes_header_beside_input_and_lists_it() {
  local fixture_root="$1"
  local input_dir="$fixture_root/audio files"
  local input_path="$input_dir/My Tune.mp3"
  local output_path="$input_dir/My Tune.h"
  local command_log="$fixture_root/commands.log"
  local output
  local header

  copy_converter "$fixture_root" || return 1
  install_fake_ffmpeg "$fixture_root"
  mkdir -p "$input_dir"
  printf 'fake audio' > "$input_path"

  output="$(PATH="$fixture_root/fake-bin:$PATH" TEST_COMMAND_LOG="$command_log" \
    "$fixture_root/tools/audio-to-header.sh" "$input_path" 2>&1)" || {
    fail "Converter failed:\n$output"
    return 1
  }

  [[ -f "$output_path" ]] || fail "Expected output file beside input: $output_path" || return 1
  header="$(<"$output_path")"
  assert_contains "$header" '#pragma once' || return 1
  assert_contains "$header" 'const uint8_t my_tune_alarm[] = {' || return 1
  assert_contains "$header" '0x00, 0x80, 0xff, 0x7f' || return 1
  assert_contains "$header" 'const uint32_t my_tune_alarm_len = 4;' || return 1
  assert_contains "$output" "$output_path"
}

test_requests_two_pass_loudness_normalized_shiftclock_pcm() {
  local fixture_root="$1"
  local input_path="$fixture_root/tone.wav"
  local command_log="$fixture_root/commands.log"
  local command_output

  copy_converter "$fixture_root" || return 1
  install_fake_ffmpeg "$fixture_root"
  printf 'fake audio' > "$input_path"

  PATH="$fixture_root/fake-bin:$PATH" TEST_COMMAND_LOG="$command_log" \
    "$fixture_root/tools/audio-to-header.sh" "$input_path" >/dev/null 2>&1 || {
    fail 'Converter failed'
    return 1
  }

  command_output="$(<"$command_log")"
  [[ "$(wc -l < "$command_log")" -eq 2 ]] || fail 'Expected two FFmpeg passes' || return 1
  assert_contains "$command_output" 'loudnorm=I=-16:LRA=11:TP=-1:print_format=json' || return 1
  assert_contains "$command_output" 'measured_I=-24.00' || return 1
  assert_contains "$command_output" 'measured_TP=-5.00' || return 1
  assert_contains "$command_output" 'measured_LRA=2.00' || return 1
  assert_contains "$command_output" 'measured_thresh=-34.00' || return 1
  assert_contains "$command_output" 'offset=0.25' || return 1
  assert_contains "$command_output" '-ac 1' || return 1
  assert_contains "$command_output" '-ar 16000' || return 1
  assert_contains "$command_output" '-c:a pcm_s16le' || return 1
  assert_contains "$command_output" '-f s16le'
}

test_rejects_a_missing_input_file() {
  local fixture_root="$1"
  local output

  copy_converter "$fixture_root" || return 1
  output="$("$fixture_root/tools/audio-to-header.sh" "$fixture_root/missing.mp3" 2>&1)" && {
    fail 'Expected converter to reject a missing input file'
    return 1
  }

  assert_contains "$output" 'input file does not exist'
}

test_does_not_overwrite_an_input_already_named_as_a_header() {
  local fixture_root="$1"
  local input_path="$fixture_root/tone.h"
  local command_log="$fixture_root/commands.log"
  local output

  copy_converter "$fixture_root" || return 1
  install_fake_ffmpeg "$fixture_root"
  printf 'original audio bytes' > "$input_path"

  output="$(PATH="$fixture_root/fake-bin:$PATH" TEST_COMMAND_LOG="$command_log" \
    "$fixture_root/tools/audio-to-header.sh" "$input_path" 2>&1)" && {
    fail 'Expected converter to reject an input whose output path is identical'
    return 1
  }

  [[ "$(<"$input_path")" == 'original audio bytes' ]] || fail 'Input file was overwritten' || return 1
  assert_contains "$output" 'output path would overwrite the input file'
}

run_test() {
  local name="$1"
  local test_function="$2"
  local fixture_root

  fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/shiftclock-audio-test.XXXXXX")"
  if "$test_function" "$fixture_root"; then
    printf 'ok - %s\n' "$name"
  else
    printf 'not ok - %s\n' "$name"
    FAILURES=$((FAILURES + 1))
  fi
  rm -rf -- "$fixture_root"
}

run_test 'writes a C header beside the input and lists it' test_writes_header_beside_input_and_lists_it
run_test 'requests two-pass -16 LUFS Shiftclock PCM conversion' test_requests_two_pass_loudness_normalized_shiftclock_pcm
run_test 'rejects a missing input file' test_rejects_a_missing_input_file
run_test 'does not overwrite an input already named as a header' test_does_not_overwrite_an_input_already_named_as_a_header

if (( FAILURES > 0 )); then
  printf '%d test(s) failed\n' "$FAILURES" >&2
  exit 1
fi

printf 'All audio-to-header tests passed\n'
