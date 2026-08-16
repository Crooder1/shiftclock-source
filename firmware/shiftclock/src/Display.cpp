#include "Display.hpp"

#include "Settings.hpp"

#include <Arduino.h>
#include <sys/time.h>

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

  displayInitialized = true;
}

void deinitializeDisplay() {

  if (!displayInitialized) return

  lc.clear();

  displayInitialized = false;
}

void displayDigit(uint8_t index, uint8_t digit, bool dp) {
  if (index > 7 || digit > 15) return;
  lc.setColumn(0, index, digit_symbols[digit] | (dp ? DP_S : 0));
}

// TODO - option for hour formatting and AM/PM
void displayTime() {

  int8_t dp_mode = getSetting(MOVINGDP_SETTING);
  int8_t meri_en = getSetting(MERIINDICATOR_SETTING);
  int8_t seconds_en = getSetting(SECONDS_SETTING);
  int8_t twelve_en = getSetting(CLOCKFORM_SETTING);
  
  struct timeval tv;
  gettimeofday(&tv, nullptr);

  uint64_t millisSinceEpoch = (uint64_t)tv.tv_sec * 1000ULL + tv.tv_usec / 1000ULL;

  time_t now = time(nullptr);

  struct tm local;
  localtime_r(&now, &local);

  // This is needed before the 12 hours formatting
  uint32_t meridiem_symbol = (local.tm_hour >= 12) ? PM_SYMBOL : AM_SYMBOL;

  uint64_t symbol = 0;

  if (twelve_en) {
    symbol = (symbol + numberToSymbol(local.tm_hour % 12, 2));
  } else {
    symbol = (symbol + numberToSymbol(local.tm_hour, 2));
  }
  symbol = symbol << 16;
  symbol = (symbol + numberToSymbol(local.tm_min, 2));

  if (seconds_en) {
    symbol = symbol << 16;
    symbol = (symbol + numberToSymbol(local.tm_sec, 2));
  }

  if (meri_en) {
    symbol = symbol << 16;
    symbol = (symbol + meridiem_symbol);
  }

  symbol += dpModeToSymbol(dp_mode, millisSinceEpoch);

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

void onBrightnessSet(int8_t brightness) {

  if (!displayInitialized) return;
  if (brightness < 0) return;

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

