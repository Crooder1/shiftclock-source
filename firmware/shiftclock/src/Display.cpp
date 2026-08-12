#include "Display.hpp"

#include <Arduino.h>

const uint8_t number_symbols[] = {ZERO, ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE};
const uint8_t number_dp_symbols[] = {ZERO_DP, ONE_DP, TWO_DP, THREE_DP, FOUR_DP, FIVE_DP, SIX_DP, SEVEN_DP, EIGHT_DP, NINE_DP};
const uint8_t digit_symbols[] = {ZERO, ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE, A_S, B_S, C_S, D_S, E_S, F_S};

MD_MAX72XX lc = MD_MAX72XX(
  MD_MAX72XX::DR0CR0RR0_HW,
  MD_MAX72XX_DIN_PIN,
  MD_MAX72XX_CLK_PIN,
  MD_MAX72XX_LOAD_PIN,
  1
);

bool displayInitialized = false;

void initializeDisplay() {

  if (displayInitialized) return;

  lc.begin();
  lc.control(MD_MAX72XX::INTENSITY, 8);   // brightness 0–15
  lc.clear();
}

void deinitializeDisplay() {

  if (!displayInitialized) return

  lc.clear();
}

void displayDigit(uint8_t index, uint8_t digit, bool dp) {
  if (index > 7 || digit > 15) return;
  lc.setColumn(0, index, digit_symbols[digit] | (dp ? DP_S : 0));
}

// TODO - option for hour formatting and AM/PM
void displayTime(uint64_t millis, uint8_t dp_mode, bool meri_en, bool seconds_en, bool twelve_en) {
  
  int seconds = (millis / 1000L) % 60;
  int minutes = (millis / (60 * 1000L)) % 60;
  int hours = (millis / (60 * 60 * 1000L)) % 24;

  // This is needed before the 12 hours formatting
  uint32_t meridiem_symbol = (hours > 12) ? PM_SYMBOL : AM_SYMBOL;

  if (twelve_en && hours > 12) hours = hours % 12;

  uint64_t symbol = 0;

  symbol = (symbol + numberToSymbol(hours, 2));
  symbol = symbol << 16;
  symbol = (symbol + numberToSymbol(minutes, 2));

  if (seconds_en) {
    symbol = symbol << 16;
    symbol = (symbol + numberToSymbol(seconds, 2));
  }

  if (meri_en) {
    symbol = symbol << 16;
    symbol = (symbol + meridiem_symbol);
  }

  symbol += dpModeToSymbol(dp_mode, millis);

  displaySymbols(symbol);
}

uint64_t symbol_cache = 0;

//helper: display up to 8 symbols
void displaySymbols(uint64_t symbols) {
  
  if (symbol_cache == symbols) return;
  
  noInterrupts();
  symbol_cache = symbols;
  for (int i = 7; i >= 0; i--) {
    int sym = (symbols >> ((7 - i) * 8)) & 0xFF;
      lc.setColumn(0, i, sym);
  }
  interrupts();
}

// helper: display up to 8 digits
void displayNumber(uint32_t num) {
  for (int i = 7; i >= 0; i--) {
    int digit = num % 10;
    lc.setColumn(0, i, number_symbols[digit]);
    num /= 10;
  }
}

void onBrightnessSet(uint8_t brightness) {

  if (!displayInitialized) return;

  lc.control(MD_MAX72XX::INTENSITY, brightness);
}

// helpers
uint64_t numberToSymbol(uint32_t num, uint8_t digits) {

  uint64_t result = 0;

  for (uint8_t i = 0; i < digits; i++) {

    uint8_t digit = num % 10;
    uint8_t symbol = number_symbols[digit];

    result += (symbol << (8 * i));

    num /= 10;

  }

  return result;
}

uint64_t dpModeToSymbol(uint8_t mode, uint64_t millis) {

  if (mode == 0) return 0;

  if (mode == 1) {
    
    uint8_t dp_location = (millis % 1000L) / (125L);
    
    // this is needed to avoid an integer underflow
    uint64_t temp_dp_symbol = DP_S;
    // update the dp_location'nth display to have the decimal
    return (temp_dp_symbol << (dp_location * 8));

  } else if (mode == 2) {

    uint8_t seconds = (millis / 1000L) % 2;

    if (seconds == 0) {
      return 0x0080008000800080;
    }

  }

  return 0;
}

