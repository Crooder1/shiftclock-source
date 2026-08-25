# Shiftclock

Shiftclock is a simple hobby clock project designed to offer features that may be elusive with other alarms.

## Getting started

Run all commands below from the repository root. The build scripts can also be invoked from another directory because they resolve paths relative to their own location.

### Required dependencies

All builds require Bash. On Windows, run the firmware and Android scripts from Git Bash or WSL with the corresponding tools available in that environment. Building for iOS requires macOS.

#### Firmware dependencies

Install [Arduino CLI](https://arduino.github.io/arduino-cli/latest/installation/) and ensure `arduino-cli` is in `PATH`. On macOS or Linux with Homebrew:

```bash
brew update
brew install arduino-cli
```

Then install the ESP32 board core and the two external Arduino libraries used by the firmware. These are the versions currently verified with this project:

```bash
ESP32_PACKAGE_INDEX_URL="https://espressif.github.io/arduino-esp32/package_esp32_index.json"
arduino-cli core update-index --additional-urls "$ESP32_PACKAGE_INDEX_URL"
arduino-cli core install "esp32:esp32@3.3.11" --additional-urls "$ESP32_PACKAGE_INDEX_URL"
arduino-cli lib install "NimBLE-Arduino@2.5.0" "MD_MAX72XX@3.5.1"
```

Create the ignored local Wi-Fi configuration from the supplied example, then replace both `XXXX` values with the clock's network credentials:

```bash
cp firmware/shiftclock/Generated.hpp.example firmware/shiftclock/Generated.hpp
```

#### Audio conversion dependencies

Converting audio files into firmware tune headers requires [FFmpeg](https://ffmpeg.org/download.html). Install it on macOS or Linux with Homebrew:

```bash
brew install ffmpeg
```

On Ubuntu/Debian:

```bash
sudo apt update
sudo apt install ffmpeg
```

#### Shared mobile app dependencies

Install the current [Node.js LTS release](https://nodejs.org/en/download), which includes npm. Install the locked JavaScript dependencies with:

```bash
cd shiftclock-app
npm ci
cd ..
```

The build scripts use the project-local Expo CLI installed by `npm ci`; a global Expo installation is not required.

#### Android dependencies

Install the following:

- [OpenJDK 17](https://docs.expo.dev/workflow/android-studio-emulator/).
- [Android Studio](https://developer.android.com/studio/install) and its Android SDK Manager.
- Android SDK Platform 36, Build-Tools 36.0.0, Platform-Tools, CMake 3.22.1, and NDK (Side by side) 27.1.12297006 through Android Studio's SDK Manager.

For example, install JDK 17 on Ubuntu/Debian with:

```bash
sudo apt update
sudo apt install openjdk-17-jdk
```

Or install it on macOS with Homebrew:

```bash
brew install --cask zulu@17
```

Set `ANDROID_HOME` to the SDK location shown by Android Studio and add the command-line tools to `PATH`. Typical values are:

```bash
# Linux
export ANDROID_HOME="$HOME/Android/Sdk"

# macOS; use this instead of the Linux value
# export ANDROID_HOME="$HOME/Library/Android/sdk"

export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools"
```

Add these exports to `~/.bashrc`, `~/.zshrc`, or the appropriate shell startup file so they persist. The first Android build also downloads the project's Gradle distribution and Maven dependencies.

#### iOS dependencies

The iOS build requires:

- macOS with [Xcode](https://developer.apple.com/xcode/) 26.4 or newer, including its command-line tools and iOS Simulator SDK.
- CocoaPods.
- The shared Node/npm dependencies installed above.

After installing Xcode from the App Store, complete its command-line setup:

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -runFirstLaunch
```

The [CocoaPods installation guide](https://guides.cocoapods.org/using/getting-started.html) recommends using a current Ruby instead of the system Ruby. The [Homebrew CocoaPods formula](https://formulae.brew.sh/formula/cocoapods) installs CocoaPods and its Ruby dependency together:

```bash
brew install cocoapods
```

Confirm `pod` and `xcodebuild` are available:

```bash
pod --version
xcodebuild -version
```

### Build and flash firmware

Connect the ESP32-C3 over USB, then run:

```bash
./tools/build-firmware.sh
```

The script lists the active serial ports and prompts for the port to use. It performs a clean build for the ESP32-C3 using a 4MB flash layout with a 2MB application partition and 2MB SPIFFS (`PartitionScheme=no_ota`), then uploads that build to the selected port.

Firmware binaries, the ELF file, and the linker map are written under:

```text
build/firmware/
```

The script prints every generated firmware output path after a successful upload.

### Build the Android APK

Run:

```bash
./tools/build-android.sh
```

The script prepares the Expo Android native project, builds the Release APK, and copies the final artifact to:

```text
build/shiftclock-android.apk
```

The absolute APK path is printed when the build completes.

### Build the iOS app

Run this command on macOS:

```bash
./tools/build-ios.sh
```

The script prepares the Expo iOS native project, installs its pods, and builds an unsigned Release app for the iOS Simulator. Xcode derived data and the `.app` bundle are written under:

```text
build/ios/
```

The exact absolute `.app` bundle path is printed when the build completes. This simulator build does not require an Apple Developer signing identity and cannot be installed directly on a physical iPhone.

### Convert audio to a firmware header

Run the converter with a WAV, MP3, or any other audio format supported by FFmpeg:

```bash
./tools/audio-to-header.sh "/path/to/WakeUp.mp3"
```

The script performs two-pass loudness normalization to -16 LUFS with a -1 dB true-peak ceiling. It converts the audio to the format expected by Shiftclock—16 kHz, mono, signed 16-bit little-endian PCM—and embeds the raw bytes in a C header.

The header is written beside the input with the same base name and a `.h` extension. The example above creates `/path/to/WakeUp.h`, replaces an existing file at that path, and prints an `ls -lh` listing of the completed file. File names are converted into valid lowercase C identifiers, so the example header contains:

```cpp
const uint8_t wakeup_alarm[] = { /* normalized PCM bytes */ };
const uint32_t wakeup_alarm_len = /* byte count */;
```

To add the generated audio as a firmware tune, place the source audio in `firmware/shiftclock/src/alarm/tunes/` before conversion, include the generated header in `TuneCatalogue.cpp`, and add an `AlarmTune` entry using its array and length symbols.
