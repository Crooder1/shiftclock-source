#pragma once

#include <Arduino.h>

constexpr size_t MAX_TUNES = 32;
constexpr size_t MAX_NAME_LENGTH = 20; // -1 for null terminator

struct AlarmTune {
  const char* name;
  const uint8_t* data;
  size_t data_length;
};

size_t getTuneCount();
bool getTune(AlarmTune& tune, uint8_t id);
