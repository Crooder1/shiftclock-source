#pragma once

#include <cstdint>
#include <string>

inline constexpr char CLOCK_NAME[] = "ShiftClock-V2";

constexpr uint8_t ALARM_DAYS_ACTIVE_MAX = 0x7F;
constexpr uint32_t ALARM_SECONDS_OF_DAY_MAX = 86399;
constexpr uint8_t ALARM_FLASH_UNTIL_OFF_MAX = 1;
constexpr uint16_t ALARM_RAMP_DURATION_SECONDS_MAX = 600;
constexpr uint8_t ALARM_VOLUME_MAX = 100;

bool initializeBLE();
bool deinitializeBLE();
bool startAdvertising();
void disconnectClient();
void emitMessage(uint8_t type, uint8_t code, const std::string& description);
