#pragma once

#include "../alarm/Alarm.hpp"

#include <Arduino.h>

// --- Uuids ---

inline constexpr char CLOCK_SERVICE_UUID[] = "8984ff44-0000-4291-868b-2a44c36ed7e8";
inline constexpr char ALARM_CHAR_UUID[] = "8984ff44-0001-4291-868b-2a44c36ed7e8";
inline constexpr char SETTINGS_CHAR_UUID[] = "8984ff44-0002-4291-868b-2a44c36ed7e8";
inline constexpr char MESSAGE_CHAR_UUID[] = "8984ff44-0003-4291-868b-2a44c36ed7e8";
inline constexpr char TUNE_CHAR_UUID[] = "8984ff44-0004-4291-868b-2a44c36ed7e8";

constexpr uint8_t PROTOCOL_HEADER = 0;

// --- Packets ---

constexpr size_t HEADER_OFFSET = 0;

constexpr size_t ALARM_COMMAND_OFFSET = 1;
constexpr size_t ALARM_ID_OFFSET = 2;
constexpr size_t ALARM_DAYS_ACTIVE_OFFSET = 3;
constexpr size_t ALARM_SECONDS_OF_DAY_OFFSET = 4;
constexpr size_t ALARM_TUNE_ID_OFFSET = 7;
constexpr size_t ALARM_RAMP_DURATION_OFFSET = 8;
constexpr size_t ALARM_VOLUME_OFFSET = 10;
constexpr size_t ALARM_AUTO_DISABLE_SECONDS_OFFSET = 11;
constexpr size_t ALARM_WRITE_PACKET_SIZE = PACKED_ALARM_SIZE + 3;
constexpr size_t ALARM_READ_ID_OFFSET = 1;
constexpr size_t ALARM_READ_PAYLOAD_OFFSET = 2;
constexpr size_t ALARM_READ_PACKET_SIZE = PACKED_ALARM_SIZE + 2;

constexpr size_t TUNE_ID_OFFSET = 1;
constexpr size_t TUNE_DATA_LENGTH_OFFSET = 2;
constexpr size_t TUNE_NAME_OFFSET = 6;
constexpr size_t TUNE_WRITE_PACKET_SIZE = 2;
constexpr size_t TUNE_READ_PACKET_SIZE = TUNE_NAME_OFFSET + MAX_NAME_LENGTH;

constexpr size_t SETTINGS_ID_OFFSET = 1;
constexpr size_t SETTINGS_VALUE_OFFSET = 2;
constexpr size_t SETTINGS_WRITE_PACKET_SIZE = 3;
constexpr size_t SETTINGS_READ_PACKET_SIZE = 8; 

constexpr size_t MESSAGE_TYPE_OFFSET = 1;
constexpr size_t MESSAGE_CODE_OFFSET = 2;
constexpr size_t MESSAGE_DESCRIPTION_OFFSET = 3;
constexpr size_t MESSAGE_DESCRIPTION_SIZE = 40;
constexpr size_t MESSAGE_PACKET_SIZE = 43;
constexpr uint16_t PREFERRED_ATT_MTU = MESSAGE_PACKET_SIZE + 3;

// --- Alarm Commands ---
constexpr uint8_t ALARM_READ_COMMAND = 0x0;
constexpr uint8_t ALARM_ADD_COMMAND = 0x1;
constexpr uint8_t ALARM_MODIFY_COMMAND = 0x2;
constexpr uint8_t ALARM_REMOVE_COMMAND = 0x3;
constexpr uint8_t ALARM_COMMIT_COMMAND = 0x4;
constexpr uint8_t ALARM_RELOAD_COMMAND = 0x5;

// --- Settings Commands ---
constexpr int8_t SETTINGS_COMMAND_ID = -1;
constexpr int8_t SETTINGS_COMMIT_VALUE = -1;
constexpr int8_t SETTINGS_RELOAD_VALUE = -2;

// --- Messages ---

// Info
constexpr uint8_t INFO_TAG = 0x00;

constexpr uint8_t INFO_OPERATION_SUCCEEDED = 0x00;

// Errors
constexpr uint8_t ERROR_TAG = 0x01;

constexpr uint8_t ERROR_BLE_JOB_QUEUE_FAILED = 0x03;
constexpr uint8_t ERROR_BLE_DISCONNECT_FAILED = 0x04;
constexpr uint8_t ERROR_INVALID_PACKET = 0x05;
constexpr uint8_t ERROR_INVALID_PACKET_SIZE = 0x06;
constexpr uint8_t ERROR_OPERATION_FAILED = 0x07;
