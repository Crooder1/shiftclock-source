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
