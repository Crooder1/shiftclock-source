#include <string>
#include <time.h>
#include "src/Display.hpp"
#include "src/Settings.hpp"
#include "src/Wifi.hpp"
#include "src/ble/BLE.hpp"

// Initialization time (current unix timestamp)
uint64_t init_time = 0;

void setup() {
  Serial.begin(115200);

  initializeDisplay();

  reloadSettings();

  if (!initializeBLE()) {
    Serial.println("BLE initialization failed");
  }
}

void loop() {

  // In loop because it crashes otherwise
  // Something about watchdog and not blocking setup()
  if (!wifi_initialized) {
    displaySymbols(CONNECTING_SYMBOL);
    initWifi();
    displaySymbols(SYNCING_SYMBOL);
    initTime();
    return;
  }

  uint64_t timezoneOffset = getSetting(TIMEZONE_SETTING);
  time_t now = time(nullptr);
  uint64_t millisTime = ((uint64_t)now * 1000ULL)+ (timezoneOffset * 3600000LL);

  displayTime(millisTime, getSetting(MOVINGDP_SETTING), getSetting(MERIINDICATOR_SETTING), getSetting(SECONDS_SETTING), getSetting(CLOCKFORM_SETTING));

  delay(1);
}
