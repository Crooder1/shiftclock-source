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
int8_t readSignedByte(const uint8_t* data, size_t length, size_t offset);
uint8_t encodeSignedByte(int8_t value);
uint32_t readInt(
    const uint8_t* data,
    size_t length,
    size_t offset,
    size_t readLength);
