/**
DESIGN NOTES

MENUES:
 - BUTTON 1 -> ALARM MENU
 - BUTTON 2 -> SETTINGS MENU
 - BUTTON 3 -> NOTHING

ALARM MENU:
 - three alarms
 - cycle to the next one using button 3
 - modify the alarm with button 2
 - LOOKS LIKE (for preset 1):
    - 1.x.x.x.HHMM
    - THEN
    - 1.SMTWTFS (weekdays)

SETTINS MENU:
 - Brightness : bri.x.x.x.(01-15)
 - Seconds : SEc.x.x.x.x.(0/1)
 - Moving DP : dP.x.x.x.x.x.(0/1/2) (off / each spot / skip a spot)
 - Audio Volume : uol.x.x.x.(01-10)
 - Alarm Hard : Hard.x.x.x.(0/1/2) (off / medium - 4 / hard - 8)
 - Alarm Fading : Fade.x.x.(0-60) (each increment is 1mins)
 - Clock Formatting: For.x.x.x.x.(0/1) (12 / 24 hour formatting)
 - AM & PM: AnPn.x.x.x.(0/1)
*/

/*

TODO 

- Implement LittleFS

*/

// Includes
#include <LedControl.h>
#include <string>
#include "settings.hpp"
#include "display.hpp"
#include "wifi.hpp"

// Button Pins
#define BTN1_PIN 0
#define BTN2_PIN 2
#define BTN3_PIN 15

// Encoder Pins
#define ENC1_PIN 13
#define ENC2_PIN 14
#define ENC3_PIN 16

// MAX7219 Pins
// TODO: SHOULD USE PROPER PINS NEXT TIME! IE. DIN->GPIO13 CLK->GPIO14 LOAD->ANY/GPIO15
#define DIN_PIN 4
#define LOAD_PIN 5
#define CLK_PIN 12

//#define SPEAKER_PIN 16

// Settings declarations

// one MAX7219 chip driving 8 digits
LedControl lc = LedControl(DIN_PIN, CLK_PIN, LOAD_PIN, 1);

// Input variables

// Start at 2 to help make the input more accurate at the start
volatile int encoder_count = 2;
int SNAP_encoder_count = 0;
int last_encoder_count = 0;
int encoder_status = 0; 

volatile bool btn1_status = 0;
volatile bool btn2_status = 0;
volatile bool btn3_status = 0;
bool SNAP_btn1_status = 0;
bool SNAP_btn2_status = 0;
bool SNAP_btn3_status = 0;

volatile bool in_menu = 0;
volatile bool settings_menu_enable = 0;
volatile bool alarm_menu_enable = 0;

uint64_t init_time = 0;

void setup() {
  Serial.begin(9600);

  // init max7219
  lc.shutdown(0, false);
  lc.setIntensity(0, 8);   // brightness 0–15
  lc.clearDisplay(0);

  initSettings(&lc);

  // Init buttons with interrupts
  pinMode(BTN1_PIN, INPUT);
  pinMode(BTN2_PIN, INPUT);
  pinMode(BTN3_PIN, INPUT);
  attachInterrupt(digitalPinToInterrupt(BTN1_PIN), onBtn1PressISR, RISING);
  attachInterrupt(digitalPinToInterrupt(BTN2_PIN), onBtn2PressISR, RISING);
  attachInterrupt(digitalPinToInterrupt(BTN3_PIN), onBtn3PressISR, FALLING);

  // Init encoder with interrupts
  pinMode(ENC1_PIN, INPUT_PULLUP);
  pinMode(ENC2_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(ENC1_PIN), encoderISR, CHANGE);
  attachInterrupt(digitalPinToInterrupt(ENC2_PIN), encoderISR, CHANGE);

  // Speaker init
  //pinMode(SPEAKER_PIN, OUTPUT_OPEN_DRAIN);

}

void loop() {

  // In loop because it crashes otherwise
  // Something about watchdog and not blocking setup()
  if (!wifi_initialized) {
    displaySymbols(&lc, CONNECTING_SYMBOL);
    initWifi();
    return;
  }

  if (!time_get_attempted) {
    displaySymbols(&lc, SYNCING_SYMBOL);
    init_time = getCurrentTime();
    
    stopWifi();
    return;
  }

  //uint32_t timeBeforeBefore = millis();
  //uint32_t timeBefore = millis();
  //uint32_t timeAfter = millis();
  //Serial.printf("TimeToMakeReq: %d %d\n", (timeAfter - timeBefore), (timeAfter - timeBeforeBefore));

  // Snapshots of button status since we don't want to deal with 
  // changes to button statuses asynchronously
  SNAP_btn1_status = btn1_status;
  SNAP_btn2_status = btn2_status;
  SNAP_btn3_status = btn3_status;

  SNAP_encoder_count = encoder_count;

  if ((SNAP_encoder_count - last_encoder_count) >= 4) {
    //Serial.println("Encoder Status Plus");
    encoder_status = 1;
  } else if ((SNAP_encoder_count - last_encoder_count) <= -4) {
    //Serial.println("Encoder Status Minus");
    encoder_status = -1;
  } else {
    encoder_status = 0;
  }

  if (settings_menu_enable) {
    doSettingsMenu();
  } else if (alarm_menu_enable) {
    doAlarmMenu();
  } else {
    uint64_t timezoneOffset = getSetting(TIMEZONE_SETTING);
    uint64_t millisTime = millis() + init_time + (timezoneOffset * 3600000L); /*1000 * 60 * 60  one hour */
    displayTime(&lc, millisTime, getSetting(MOVINGDP_SETTING), getSetting(MERIINDICATOR_SETTING), getSetting(SECONDS_SETTING), getSetting(CLOCKFORM_SETTING));

  }

  // Only reset if snapshot is true, fixes buttons not working sometimes
  if (SNAP_btn1_status) btn1_status = 0;
  if (SNAP_btn2_status) btn2_status = 0;
  if (SNAP_btn3_status) btn3_status = 0;

  if ((SNAP_encoder_count - last_encoder_count) >= 4 || (SNAP_encoder_count - last_encoder_count) <= -4) {
    Serial.print("Encoder Reset");
    Serial.print(last_encoder_count);
    Serial.println(SNAP_encoder_count);
    last_encoder_count = SNAP_encoder_count;
  }

  // Small delay
  delay(1);
}

// ---------- ALARM MENU ----------

void doAlarmMenu() {

  if (btn2_status) {
    alarm_menu_enable = false;
    in_menu = false;
    lc.clearDisplay(0);
    return;
  }

}

// ---------- ALARM MENU END ----------

// ---------- SETTINGS MENU ----------

// @Scope Variable
int32_t settings_menu_index = 0;

//uint32_t TEMP_count_var = 0;

void doSettingsMenu() {

  // Check if should quit menu
  if (SNAP_btn2_status) {
    Serial.println("Settings Exit");
    settings_menu_enable = false;
    in_menu = false;
    lc.clearDisplay(0);
    return;
  }

  if (SNAP_btn1_status) {
    Serial.println("Settings Plus");
    settings_menu_index++;
  }

  if (SNAP_btn3_status) {
    Serial.println("Settings Minus");
    settings_menu_index--;
  }

  // Modulo alternative, unsure why builtin doesnt work
  //settings_menu_index = settings_menu_index - ((int) (settings_menu_index / 9)) * 9;

  //settings_menu_index = settings_menu_index % 9;

  if (settings_menu_index < 0) settings_menu_index = 9;
  else if (settings_menu_index > 9) settings_menu_index = 0;

  struct SettingsEntry entry = settings_array[settings_menu_index];
  
  setSetting(settings_menu_index, entry.value + encoder_status);

  //TEMP_count_var += encoder_status;
  //encoder_status = 0;

  // TODO add entry.value_length for amount of digits
  uint64_t extra = numberToSymbol(entry.value, entry.value_length);

  displaySymbols(&lc, entry.base_symbol + extra);  

}

// ---------- SETTINGS MENU END ----------

// ---------- HANDLERS----------

IRAM_ATTR void onBtn1PressISR() {

  // If not in menu then enable a menu
  if (!in_menu) {
    in_menu = true;
    alarm_menu_enable = true;
    return;
  }

  // After since we dont want to set if we are entering a menu
  // TODO - add a proper way to handle menues, maybe menu IDs and handler functions?
  btn1_status = true;
}

IRAM_ATTR void onBtn2PressISR() {

  if (!in_menu) {
    in_menu = true;
    settings_menu_enable = true;
    return;
  }

  btn2_status = true;
}

IRAM_ATTR void onBtn3PressISR() {
  btn3_status = true;
}

// @Scope Variable
volatile uint8_t lastState = 0;

IRAM_ATTR void encoderISR() {
  uint8_t s = (digitalRead(ENC1_PIN) << 1) | digitalRead(ENC2_PIN); // 2-bit current state
  int8_t delta = 0;

  // decode quadrature sequence
  if (lastState == 0b00) {
    if (s == 0b01) delta = +1;
    else if (s == 0b10) delta = -1;
  } else if (lastState == 0b01) {
    if (s == 0b11) delta = +1;
    else if (s == 0b00) delta = -1;
  } else if (lastState == 0b11) {
    if (s == 0b10) delta = +1;
    else if (s == 0b01) delta = -1;
  } else if (lastState == 0b10) {
    if (s == 0b00) delta = +1;
    else if (s == 0b11) delta = -1;
  }

  encoder_count += delta;
  lastState = s;
}

// ---------- HANDLERS END ----------

