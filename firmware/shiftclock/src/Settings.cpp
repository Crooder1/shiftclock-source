#include "Settings.hpp"

#include "Display.hpp"
#include "Wifi.hpp"

#include <Preferences.h>

Preferences settings_preferences;

SettingsEntry settings_array[] = {
  {TIMEZONE_SETTING,      "Timezone",      "tz",  -5, -12, 11, setTimezoneOffset, NULL},
  {BRIGHTNESS_SETTING,    "Brightness",    "bri", 8,  0, 15,   onBrightnessSet, NULL},
  {SECONDS_SETTING,       "Seconds",       "sec", 0,  0, 1,    NULL, NULL},
  {MOVINGDP_SETTING,      "MovingDP",      "dp",  0,  0, 2,    NULL, NULL},
  {VOLUME_SETTING,        "Volume",        "vol", 20, 0, 100,  NULL, NULL},
  {CLOCKFORM_SETTING,     "ClockForm",     "24h", 0,  0, 1,    NULL, NULL},
  {MERIINDICATOR_SETTING, "MeriIndicator", "mer", 1,  0, 1,    NULL, NULL}
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
    Serial.println("Settings Preferences Failed To Open");
    return false;
  }

  for (uint8_t x = 0; x < SETTINGS_COUNT; x++) {

    const SettingsEntry& entry = settings_array[x];
    std::string key = entry.key;
    int8_t value = entry.value;

    if (
      settings_preferences.isKey(key.c_str())
      && settings_preferences.getChar(key.c_str(), value) == value
    ) {
      continue;
    }

    if (!settings_preferences.putChar(key.c_str(), value)) {
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
    Serial.println("Settings Preferences Failed To Open");
    return false;
  }

  for (uint8_t x = 0; x < SETTINGS_COUNT; x++) {

    SettingsEntry& entry = settings_array[x];
    uint8_t id = entry.id;
    std::string key = entry.key;

    const int8_t value = settings_preferences.getChar(key.c_str(), entry.value);

    setSetting(id, value);
  }

  Serial.println("Settings Reloaded");

  settings_preferences.end();
  return true;
}
