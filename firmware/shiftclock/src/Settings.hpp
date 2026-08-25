#pragma once

#include <Arduino.h>
#include <string>

#define TIMEZONE_SETTING 0
#define BRIGHTNESS_DAY_SETTING 1 
#define BRIGHTNESS_NIGHT_SETTING 2
#define DAY_NIGHT_CUTOFF_SETTING 3
#define NIGHT_DAY_CUTOFF_SETTING 4
#define SECONDS_SETTING 5 
#define MOVINGDP_SETTING 6 
#define VOLUME_SETTING 7
#define CLOCKFORM_SETTING 8
#define MERIINDICATOR_SETTING 9

#define SETTINGS_COUNT 10

#define SETTINGS_PREFS_NAMESPACE "settings"

struct SettingsEntry {
  uint8_t id;
  std::string name;
  std::string key;
  int8_t value; // also serves as default value
  int8_t min_value; // both inclusive
  int8_t max_value;
  void (*onSet)(); // Nullable
  void (*onGet)(); // Nullable
};

void setSetting(uint8_t, int8_t);
int8_t getSetting(uint8_t);

bool loadSettings();
bool commitSettings();
