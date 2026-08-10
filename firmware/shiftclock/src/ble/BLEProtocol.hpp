#pragma once

#include <cstddef>
#include <cstdint>

// --- Uuids ---

inline constexpr char CLOCK_SERVICE_UUID[] = "8984ff44-0000-4291-868b-2a44c36ed7e8";
inline constexpr char ALARM_CHAR_UUID[] = "8984ff44-0001-4291-868b-2a44c36ed7e8";
inline constexpr char SETTINGS_CHAR_UUID[] = "8984ff44-0002-4291-868b-2a44c36ed7e8";
inline constexpr char MESSAGE_CHAR_UUID[] = "8984ff44-0003-4291-868b-2a44c36ed7e8";

constexpr uint8_t PROTOCOL_HEADER = 0;

// --- Packets ---

constexpr size_t HEADER_OFFSET = 0;

constexpr size_t ALARM_DAYS_ACTIVE_OFFSET = 1;
constexpr size_t ALARM_SECONDS_OF_DAY_OFFSET = 2;
constexpr size_t ALARM_FLASH_UNTIL_OFF_OFFSET = 5;
constexpr size_t ALARM_RAMP_DURATION_OFFSET = 6;
constexpr size_t ALARM_VOLUME_OFFSET = 8;
constexpr size_t ALARM_PACKET_SIZE = 9;

constexpr size_t SETTINGS_ID_OFFSET = 1;
constexpr size_t SETTINGS_VALUE_OFFSET = 2;
constexpr size_t SETTINGS_PACKET_SIZE = 3;

constexpr size_t MESSAGE_TYPE_OFFSET = 1;
constexpr size_t MESSAGE_CODE_OFFSET = 2;
constexpr size_t MESSAGE_DESCRIPTION_OFFSET = 3;
constexpr size_t MESSAGE_DESCRIPTION_SIZE = 40;
constexpr size_t MESSAGE_PACKET_SIZE = 43;
constexpr uint16_t PREFERRED_ATT_MTU = MESSAGE_PACKET_SIZE + 3;

// --- Messages ---

// Info
constexpr uint8_t INFO_TAG = 0x00;

// Errors
constexpr uint8_t ERROR_TAG = 0x01;

constexpr uint8_t ERROR_BLE_JOB_QUEUE_FAILED = 0x03;
constexpr uint8_t ERROR_BLE_DISCONNECT_FAILED = 0x04;
constexpr uint8_t ERROR_INVALID_PACKET = 0x05;
constexpr uint8_t ERROR_INVALID_PACKET_SIZE = 0x06;
