#pragma once

#include <cstdint>
#include <string>

inline constexpr char CLOCK_NAME[] = "ShiftClock-V2";

bool initializeBLE();
bool deinitializeBLE();
bool startAdvertising();
void disconnectClient();
void emitMessage(uint8_t type, uint8_t code, const std::string& description);
