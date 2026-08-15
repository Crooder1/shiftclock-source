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
