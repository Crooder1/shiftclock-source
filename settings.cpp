#include "settings.hpp"
#include <Arduino.h>

struct SettingsEntry settings_array[] = {
  {TIMEZONE_SETTING,      "Timezone",       19, 0, 23,  0x6D1D154f80800000, 2, NULL, NULL},
  {BRIGHTNESS_SETTING,    "Brightness",     8,  0, 15,  0x1F05308080800000, 2, onBrightnessSet, NULL},
  {SECONDS_SETTING,       "Seconds",        0,  0, 1,   0x5B4F4E8080808000, 1, NULL, NULL},
  {MOVINGDP_SETTING,      "MovingDP",       0,  0, 2,   0x3D67808080808000, 1, NULL, NULL},
  {VOLUME_SETTING,        "Volume",         20, 0, 100, 0x1C1D308080000000, 3, NULL, NULL},
  {ALARMGAME_SETTING,     "AlarmHard",      0,  0, 2,   0x3777053D80808000, 1, NULL, NULL},
  {ALARMRAMP_SETTING,     "AlarmFading",    0,  0, 60,  0x47773D4F80800000, 2, NULL, NULL},
  {CLOCKFORM_SETTING,     "ClockForm",      0,  0, 1,   0x471D058080808000, 1, NULL, NULL},
  {MERIINDICATOR_SETTING, "MeriIndicator",  1,  0, 1,   0x7715671580808000, 1, NULL, NULL},
  {TESTING_SETTING,       "Testing",        0,  0, 0,   0x0102040810204080, 0, NULL, NULL},
};

MD_MAX72XX* settings_lc = NULL;
bool initialized = false;

void initSettings(MD_MAX72XX* lc_in) {
  settings_lc = lc_in;
  initialized = true;
}

void setSetting(uint8_t id, int8_t val) {

  //if (!initialized) return;

  struct SettingsEntry entry = settings_array[id];

  // Bounds check
  if (val < entry.min_value) val = entry.min_value;
  if (entry.max_value < val) val = entry.max_value;

  // Skip onSet if value doesn't change
  if (entry.value == val) return;

  // Need this explicit line to not modify the copy
  settings_array[id].value = val;

  if (entry.onSet != NULL) entry.onSet(val);
}

int8_t getSetting(uint8_t id) {

  //if (!initialized) return 0;

  struct SettingsEntry entry = settings_array[id];

  if (entry.onGet != NULL) entry.onGet(entry.value);

  return entry.value;
}

void onBrightnessSet(uint8_t brightness) {

  if (!initialized) return;

  settings_lc->control(MD_MAX72XX::INTENSITY, brightness);
}
