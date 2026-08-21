#include "BLEHelper.hpp"

#include "BLE.hpp"
#include "BLEProtocol.hpp"

bool hasSupportedHeader(const uint8_t* data, size_t length) {
  return hasBytes(data, length, HEADER_OFFSET, sizeof(uint8_t))
      && data[HEADER_OFFSET] == PROTOCOL_HEADER;
}

bool hasBytes(
    const uint8_t* data,
    size_t length,
    size_t offset,
    size_t readLength) {
  return data != nullptr
      && offset <= length
      && readLength <= length - offset;
}

uint8_t readByte(const uint8_t* data, size_t length, size_t offset) {
  if (!hasBytes(data, length, offset, sizeof(uint8_t))) return 0;
  return data[offset];
}

int8_t readSignedByte(const uint8_t* data, size_t length, size_t offset) {
  const uint8_t value = readByte(data, length, offset);
  return value <= INT8_MAX
    ? static_cast<int8_t>(value)
    : static_cast<int8_t>(static_cast<int16_t>(value) - 256);
}

uint8_t encodeSignedByte(int8_t value) {
  return static_cast<uint8_t>(value);
}

uint32_t readInt(
    const uint8_t* data,
    size_t length,
    size_t offset,
    size_t readLength) {
  if (
    readLength > sizeof(uint32_t)
    || !hasBytes(data, length, offset, readLength)
  ) return 0;

  uint32_t value = 0;
  for (size_t i = 0; i < readLength; ++i) {
    value |= static_cast<uint32_t>(data[offset + i]) << (8 * i);
  }
  return value;
}
