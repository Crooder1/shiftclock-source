#include "Settings.hpp"

#include "Display.hpp"
#include "Wifi.hpp"

#include <Preferences.h>

Preferences settings_preferences;

SettingsEntry settings_array[] = {
  {TIMEZONE_SETTING,      "Timezone",      "tz",  19, -12, 11,  0x6D1D154f80800000, 2, setTimezoneOffset, NULL},
  {BRIGHTNESS_SETTING,    "Brightness",    "bri", 8,  0, 15,  0x1F05308080800000, 2, onBrightnessSet, NULL},
  {SECONDS_SETTING,       "Seconds",       "sec", 0,  0, 1,   0x5B4F4E8080808000, 1, NULL, NULL},
  {MOVINGDP_SETTING,      "MovingDP",      "dp",  0,  0, 2,   0x3D67808080808000, 1, NULL, NULL},
  {VOLUME_SETTING,        "Volume",        "vol", 20, 0, 100, 0x1C1D308080000000, 3, NULL, NULL},
  {CLOCKFORM_SETTING,     "ClockForm",     "24h", 0,  0, 1,   0x471D058080808000, 1, NULL, NULL},
  {MERIINDICATOR_SETTING, "MeriIndicator", "mer", 1,  0, 1,   0x7715671580808000, 1, NULL, NULL},
};

void setSetting(uint8_t id, int8_t val) {

  SettingsEntry& entry = settings_array[id];

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

  const SettingsEntry& entry = settings_array[id];

  if (entry.onGet != NULL) entry.onGet(entry.value);

  return entry.value;
}

bool commitSettings() {

  if (!settings_preferences.begin(SETTINGS_PREFS_NAMESPACE, false)) {
    return false;
  }

  for (uint8_t x = 0; x < SETTINGS_COUNT; x++) {

    const SettingsEntry& entry = settings_array[x];
    std::string key = entry.key;
    uint8_t value = entry.value;

    if (settings_preferences.isKey(key.c_str())) {
      uint8_t oldValue = settings_preferences.getUChar(key.c_str(), value);

      if (value == oldValue) {
        continue;
      }
    }

    if (!settings_preferences.putUChar(key.c_str(), value)) {
      settings_preferences.end();
      return false;
    }
  }

  Serial.println("Settings Committed");

  settings_preferences.end();
  return true;
}

bool loadSettings() {

  if (!settings_preferences.begin(SETTINGS_PREFS_NAMESPACE, true)) {
    return false;
  }

  for (uint8_t x = 0; x < SETTINGS_COUNT; x++) {

    SettingsEntry& entry = settings_array[x];
    uint8_t id = entry.id;
    std::string key = entry.key;

    uint8_t value = settings_preferences.getUChar(key.c_str(), entry.value);
    setSetting(id, value);
  }

  Serial.println("Settings Reloaded");

  settings_preferences.end();
  return true;
}