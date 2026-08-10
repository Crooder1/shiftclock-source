#include <MD_MAX72xx.h>
#include <string>

#include "src/Display.hpp"
#include "src/Settings.hpp"
#include "src/ble/BLE.hpp"

// MAX7219 Pins
// TODO: SHOULD USE PROPER PINS NEXT TIME! IE. DIN->GPIO13 CLK->GPIO14 LOAD->ANY/GPIO15
#define DIN_PIN 7
#define LOAD_PIN 10
#define CLK_PIN 6

// Settings declarations

// one MAX7219 chip driving 8 digits
MD_MAX72XX lc = MD_MAX72XX(MD_MAX72XX::DR0CR0RR0_HW, DIN_PIN, CLK_PIN, LOAD_PIN, 1);

volatile bool in_menu = 0;
volatile bool settings_menu_enable = 0;
volatile bool alarm_menu_enable = 0;

// Initialization time (current unix timestamp)
uint64_t init_time = 0;

void setup() {
  Serial.begin(9600);

  // init max7219
  lc.begin();
  lc.control(MD_MAX72XX::INTENSITY, 8);   // brightness 0–15
  lc.clear();

  initSettings(&lc);

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
  displayTime(&lc, millisTime, getSetting(MOVINGDP_SETTING), getSetting(MERIINDICATOR_SETTING), getSetting(SECONDS_SETTING), getSetting(CLOCKFORM_SETTING));

  // Small delay
  delay(1);
}
