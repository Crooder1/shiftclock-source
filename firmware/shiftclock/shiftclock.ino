#include <string>
#include "src/Display.hpp"
#include "src/Settings.hpp"
#include "src/ble/BLE.hpp"

// Initialization time (current unix timestamp)
uint64_t init_time = 0;

void setup() {
  Serial.begin(9600);

  initializeDisplay();
  initSettings();

  if (!initializeBLE()) {
    Serial.println("BLE initialization failed");
  }
}

void loop() {

  // In loop because it crashes otherwise
  // Something about watchdog and not blocking setup()
  //TODO: Needs to be BLE instead
  // if (!wifi_initialized) {
  //   displaySymbols(&lc, CONNECTING_SYMBOL);
  //   initWifi();
  //   return;
  // }

  uint64_t timezoneOffset = getSetting(TIMEZONE_SETTING);
  uint64_t millisTime = millis() + init_time + (timezoneOffset * 3600000L); /*1000 * 60 * 60  one hour */
  displayTime(millisTime, getSetting(MOVINGDP_SETTING), getSetting(MERIINDICATOR_SETTING), getSetting(SECONDS_SETTING), getSetting(CLOCKFORM_SETTING));

  // Small delay
  delay(1);
}
