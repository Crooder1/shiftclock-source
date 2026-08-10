#pragma once

#include <cstddef>
#include <cstdint>

bool hasSupportedHeader(const uint8_t* data, size_t length);
bool hasBytes(
    const uint8_t* data,
    size_t length,
    size_t offset,
    size_t readLength);
uint8_t readByte(const uint8_t* data, size_t length, size_t offset);
uint32_t readInt(
    const uint8_t* data,
    size_t length,
    size_t offset,
    size_t readLength);

bool isValidAlarmPacket(const uint8_t* data, size_t length);
bool isValidSettingsPacket(const uint8_t* data, size_t length);
