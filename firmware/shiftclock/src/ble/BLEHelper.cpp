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

bool isValidAlarmPacket(const uint8_t* data, size_t length) {
  if (length != ALARM_PACKET_SIZE || !hasSupportedHeader(data, length)) {
    return false;
  }

  return readByte(data, length, ALARM_DAYS_ACTIVE_OFFSET)
          <= ALARM_DAYS_ACTIVE_MAX
      && readInt(data, length, ALARM_SECONDS_OF_DAY_OFFSET, 3)
          <= ALARM_SECONDS_OF_DAY_MAX
      && readByte(data, length, ALARM_FLASH_UNTIL_OFF_OFFSET)
          <= ALARM_FLASH_UNTIL_OFF_MAX
      && readInt(data, length, ALARM_RAMP_DURATION_OFFSET, 2)
          <= ALARM_RAMP_DURATION_SECONDS_MAX
      && readByte(data, length, ALARM_VOLUME_OFFSET) <= ALARM_VOLUME_MAX;
}

bool isValidSettingsPacket(const uint8_t* data, size_t length) {
  return length == SETTINGS_PACKET_SIZE && hasSupportedHeader(data, length);
}
