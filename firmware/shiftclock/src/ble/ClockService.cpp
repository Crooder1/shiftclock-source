#include "ClockService.hpp"

#include "../Settings.hpp"
#include "BLE.hpp"
#include "BLEHelper.hpp"
#include "BLEProtocol.hpp"
#include "BLETaskQueue.hpp"

#include <Arduino.h>
#include <string>

namespace {

NimBLECharacteristic* messageCharacteristic = nullptr;
AlarmWriteCallback alarmWriteCallback;
SettingsCallback settingsCallback;

} // namespace

NimBLEService* createClockService(NimBLEServer& server) {
  NimBLEService* service = server.createService(CLOCK_SERVICE_UUID);
  if (service == nullptr) return nullptr;

  NimBLECharacteristic* alarm = service->createCharacteristic(
    ALARM_CHAR_UUID,
    NIMBLE_PROPERTY::WRITE |
    NIMBLE_PROPERTY::WRITE_NR
  );
  alarm->setCallbacks(&alarmWriteCallback);

  NimBLECharacteristic* settings = service->createCharacteristic(
    SETTINGS_CHAR_UUID,
    NIMBLE_PROPERTY::WRITE |
    NIMBLE_PROPERTY::WRITE_NR |
    NIMBLE_PROPERTY::READ
  );
  settings->setCallbacks(&settingsCallback);

  messageCharacteristic = service->createCharacteristic(
    MESSAGE_CHAR_UUID,
    NIMBLE_PROPERTY::NOTIFY
  );

  if (!service->start()) {
    messageCharacteristic = nullptr;
    return nullptr;
  }

  return service;
}

void deinitializeClockService() {
  messageCharacteristic = nullptr;
}

NimBLECharacteristic* getMessageCharacteristic() {
  return messageCharacteristic;
}

void AlarmWriteCallback::onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& connection) {
  (void)connection;

  const std::string value = characteristic->getValue();
  const auto* data = reinterpret_cast<const uint8_t*>(value.data());
  size_t dataLength = value.size();

  if (value.size() != ALARM_PACKET_SIZE) {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET_SIZE, "Write Alarm: Invalid Size");
    return;
  }

  if (!isValidAlarmPacket(data, value.size())) {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Write Alarm: Invalid Packet");
    return;
  }

  ClockJob clockJob;
  clockJob.type = ClockJobType::Alarm;
  memcpy(&(clockJob.packet), data, dataLength);

  if (!queueClockJob(clockJob)) {
    emitMessage(ERROR_TAG, ERROR_BLE_JOB_QUEUE_FAILED, "Write Alarm: Queue Full");
  }
}

void SettingsCallback::onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& connection) {
  (void)connection;

  const std::string value = characteristic->getValue();
  const auto* data = reinterpret_cast<const uint8_t*>(value.data());
  size_t dataLength = value.size();

  if (value.size() != SETTINGS_WRITE_PACKET_SIZE) {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET_SIZE, "Write Settings: Invalid Size");
    return;
  }

  if (!isValidSettingsPacket(data, value.size())) {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Write Settings: Invalid Packet");
    return;
  }

  ClockJob clockJob;
  clockJob.type = ClockJobType::Settings;
  memcpy(&(clockJob.packet), data, dataLength);

  if (!queueClockJob(clockJob)) {
    emitMessage(ERROR_TAG, ERROR_BLE_JOB_QUEUE_FAILED, "Write Settings: Queue Full");
  }
}

static_assert(
  SETTINGS_COUNT + 1 == SETTINGS_READ_PACKET_SIZE
);

void SettingsCallback::onRead(NimBLECharacteristic* characteristic, NimBLEConnInfo& connection) {
  (void)connection;

  uint8_t packet[SETTINGS_READ_PACKET_SIZE];
  packet[0] = PROTOCOL_HEADER;
  
  for (uint8_t x = 0; x < SETTINGS_COUNT; x++) {
    packet[1 + x] = getSetting(x);
  }

  characteristic->setValue(packet, sizeof(packet));
}

void processAlarmWrite(const uint8_t (&packet)[ALARM_PACKET_SIZE]) {
  // todo
}

void processSettingsWrite(const uint8_t (&packet)[SETTINGS_WRITE_PACKET_SIZE]) {

  uint8_t settingId = packet[SETTINGS_ID_OFFSET];
  uint8_t settingValue = packet[SETTINGS_VALUE_OFFSET];

  if (settingId == 0xFF && settingValue == 0xFF) {
    if (commitSettings()) {
      emitMessage(INFO_TAG, INFO_OPERATION_SUCCEEDED, "Settings Write Succeeded");
    }
    return;
  } else if (settingId == 0xFF && settingValue == 0xFE) {
    if (reloadSettings()) {
      emitMessage(INFO_TAG, INFO_OPERATION_SUCCEEDED, "Settings Write Succeeded");
    }
    return;
  }

  if (settingId > 6) {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Invalid Setting");
    return;
  }

  setSetting(settingId, settingValue);
  emitMessage(INFO_TAG, INFO_OPERATION_SUCCEEDED, "Settings Write Succeeded");
}
