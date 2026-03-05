#pragma once

#include <Arduino.h>
#include <stdint.h>
#include <stddef.h>
#include <LedControl.h>
#include <string>

#define TIMEZONE_SETTING 0
#define BRIGHTNESS_SETTING 1
#define SECONDS_SETTING 2
#define MOVINGDP_SETTING 3
#define VOLUME_SETTING 4
#define ALARMGAME_SETTING 5
#define ALARMRAMP_SETTING 6
#define CLOCKFORM_SETTING 7
#define MERIINDICATOR_SETTING 8
#define TESTING_SETTING 9

struct SettingsEntry {
  uint8_t id;
  std::string name;
  int8_t value; // also serves as default value
  uint8_t min_value; // both inclusive
  uint8_t max_value;
  uint64_t base_symbol;
  uint8_t value_length;
  void (*onSet)(uint8_t); // Nullable
  void (*onGet)(uint8_t); // Nullable

};

extern struct SettingsEntry settings_array[];

void initSettings(LedControl*);

void setSetting(uint8_t, int8_t);
int8_t getSetting(uint8_t);

void onBrightnessSet(uint8_t);