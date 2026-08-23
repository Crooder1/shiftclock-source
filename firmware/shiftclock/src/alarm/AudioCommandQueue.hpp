#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

enum class AudioCommandType : uint8_t {
  PlayTune,
  Stop
};

struct AudioCommand {
  AudioCommandType type = AudioCommandType::Stop;
  uint8_t tuneId = 0xFF;
  void (*onComplete)() = nullptr;
};

template <size_t PlayCapacity>
class AudioCommandQueue {
  static_assert(PlayCapacity > 0, "Audio command queue capacity must be positive");

  static constexpr size_t StorageCapacity = PlayCapacity + 1;

public:
  bool pushPlay(const AudioCommand& command) {
    if (command.type != AudioCommandType::PlayTune || count >= PlayCapacity) {
      return false;
    }

    return push(command);
  }

  bool pushStop() {
    if (
      count > 0
      && commands[(head + count - 1) % StorageCapacity].type == AudioCommandType::Stop
    ) {
      return true;
    }

    return push({AudioCommandType::Stop, 0xFF, nullptr});
  }

  bool pop(AudioCommand& command) {
    if (empty()) return false;

    command = commands[head];
    head = (head + 1) % StorageCapacity;
    --count;
    return true;
  }

  bool empty() const {
    return count == 0;
  }

  bool full() const {
    return count == StorageCapacity;
  }

private:
  bool push(const AudioCommand& command) {
    if (full()) return false;

    commands[(head + count) % StorageCapacity] = command;
    ++count;
    return true;
  }

  std::array<AudioCommand, StorageCapacity> commands{};
  size_t head = 0;
  size_t count = 0;
};
