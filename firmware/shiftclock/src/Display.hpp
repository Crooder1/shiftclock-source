#pragma once

#include <Arduino.h>
#include <MD_MAX72xx.h>

// S standards for symbol
#define DP_S 0x80

#define A_S 0x77
#define A_DP_S 0xF7 
#define B_S 0x1F
#define B_DP_S 0x9F
#define C_S 0x4E
#define C_DP_S 0xCE
#define D_S 0x3D
#define D_DP_S 0xBD
#define E_S 0x4F
#define E_DP_S 0xCF
#define F_S 0x47
#define F_DP_S 0xC7
#define G_S 0x7B
#define G_DP_S 0xFBc
#define H_S 0x37
#define H_DP_S 0xB7
#define I_S 0x30
#define I_DP_S 0xB0

#define N_S 0x15
#define N_DP_S 0x95
#define O_S 0x1D
#define O_DP_S 0x9D
#define P_S 0x67
#define P_DP_S 0xE7

#define R_S 0x05
#define R_DP_S 0x85
#define S_S 0x5B
#define S_DP_S 0xDB

#define U_S 0x1C
#define U_DP_S 0x9C

#define Y_S 0x3B
#define Y_DP_S 0xBB

#define ZERO 0x7E
#define ZERO_DP 0xFE
#define ONE 0x30
#define ONE_DP 0xB0
#define TWO 0x6D
#define TWO_DP 0xED
#define THREE 0x79
#define THREE_DP 0xF9
#define FOUR 0x33
#define FOUR_DP 0xB3
#define FIVE 0x5B
#define FIVE_DP 0xDB
#define SIX 0x1F
#define SIX_DP 0x9F
#define SEVEN 0x70
#define SEVEN_DP 0xF0
#define EIGHT 0x7F
#define EIGHT_DP 0xFF
#define NINE 0x7B
#define NINE_DP 0xFB

#define AM_SYMBOL 0x7715
#define PM_SYMBOL 0x6715

#define CONNECTING_SYMBOL 0x4E1D151580808080
#define SYNCING_SYMBOL 0x5B3B154E80808080

#define MD_MAX72XX_DIN_PIN 7
#define MD_MAX72XX_LOAD_PIN 10
#define MD_MAX72XX_CLK_PIN 6

//#define NUMBER_SYMBOLS {ZERO, ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE}
//#define NUMBER_SYMBOLS_DP {ZERO_DP, ONE_DP, TWO_DP, THREE_DP, FOUR_DP, FIVE_DP, SIX_DP, SEVEN_DP, EIGHT_DP, NINE_DP}
extern const uint8_t number_symbols[];
extern const uint8_t number_dp_symbols[];

void initializeDisplay();
void deinitializeDisplay();

void displayTime();
void displayDigit(uint8_t, uint8_t, bool);
void displaySymbols(uint64_t);
void displayNumber(uint32_t);

void onBrightnessSet(int8_t);

// helpers
uint64_t numberToSymbol(uint32_t, uint8_t);
uint64_t dpModeToSymbol(uint8_t, uint64_t);