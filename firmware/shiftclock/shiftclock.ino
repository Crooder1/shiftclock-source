#include "src/Display.hpp"
#include "src/Settings.hpp"
#include "src/Wifi.hpp"
#include "src/ble/BLE.hpp"
#include "src/alarm/Alarm.hpp"

#define BUTTON_PIN 9

volatile bool buttonStatus = false;

void setup() {
  Serial.begin(115200);

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), onButtonPressISR, FALLING);

  initializeDisplay();

  loadSettings();

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

    if (!initializeAlarms()) {
      Serial.println("Alarm initialization failed");
    }

    return;
  }

  if (buttonStatus) {
    cancelAudio();
    buttonStatus = false;
  }

  displayTime();

  delay(1);
}

IRAM_ATTR void onButtonPressISR() {
  buttonStatus = true;
}