#pragma once

#include <Arduino.h>
#include <string>

#define TIMEZONE_SETTING 0
#define BRIGHTNESS_SETTING 1
#define SECONDS_SETTING 2
#define MOVINGDP_SETTING 3
#define VOLUME_SETTING 4
#define CLOCKFORM_SETTING 5
#define MERIINDICATOR_SETTING 6

#define SETTINGS_COUNT 7

#define SETTINGS_PREFS_NAMESPACE "clock"

struct SettingsEntry {
  uint8_t id;
  std::string name;
  std::string key;
  int8_t value; // also serves as default value
  uint8_t min_value; // both inclusive
  uint8_t max_value;
  uint64_t base_symbol;
  uint8_t value_length;
  void (*onSet)(uint8_t); // Nullable
  void (*onGet)(uint8_t); // Nullable
};

extern struct SettingsEntry settings_array[];

void setSetting(uint8_t, int8_t);
int8_t getSetting(uint8_t);

bool loadSettings();
bool commitSettings();
