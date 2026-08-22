#include "TuneCatalogue.hpp"

#include <array>

#include "Push.h"

const std::array tune_array{
  AlarmTune{ .name = "Push", .data = push_alarm, .data_length = push_alarm_len }
};

size_t getTuneCount() {
  return tune_array.size();
}

bool getTune(AlarmTune& tune, uint8_t id) {

  if (id >= tune_array.size()) return false;

  tune = tune_array.at(id);
  return true;
}

// sampleRate: 16000 bytes/second
// bitDepth  : 2 bytes/sample
// channels  : 1
uint32_t getTuneDurationMs(const AlarmTune& tune) {
  return (tune.data_length * 1000ULL) / 32000;
}
