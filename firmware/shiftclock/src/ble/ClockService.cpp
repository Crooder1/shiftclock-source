#include "ClockService.hpp"

#include "BLE.hpp"
#include "BLEHelper.hpp"
#include "BLEProtocol.hpp"
#include "BLETaskQueue.hpp"

#include <cstdint>
#include <string>

namespace {

NimBLECharacteristic* messageCharacteristic = nullptr;
AlarmWriteCallback alarmWriteCallback;
SettingsWriteCallback settingsWriteCallback;

} // namespace

NimBLEService* createClockService(NimBLEServer& server) {
  NimBLEService* service = server.createService(CLOCK_SERVICE_UUID);
  if (service == nullptr) return nullptr;

  NimBLECharacteristic* alarm = service->createCharacteristic(
      ALARM_CHAR_UUID,
      NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR,
      ALARM_PACKET_SIZE);
  alarm->setCallbacks(&alarmWriteCallback);

  NimBLECharacteristic* settings = service->createCharacteristic(
      SETTINGS_CHAR_UUID,
      NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR,
      SETTINGS_PACKET_SIZE);
  settings->setCallbacks(&settingsWriteCallback);

  messageCharacteristic = service->createCharacteristic(
      MESSAGE_CHAR_UUID,
      NIMBLE_PROPERTY::NOTIFY,
      MESSAGE_PACKET_SIZE);

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

void AlarmWriteCallback::onWrite(
    NimBLECharacteristic* characteristic,
    NimBLEConnInfo& connection) {
  (void)connection;

  const std::string value = characteristic->getValue();
  const auto* data = reinterpret_cast<const uint8_t*>(value.data());

  if (value.size() != ALARM_PACKET_SIZE) {
    emitMessage(
        ERROR_TAG,
        ERROR_INVALID_PACKET_SIZE,
        "Write Alarm: Invalid Size");
    return;
  }

  if (!isValidAlarmPacket(data, value.size())) {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Write Alarm: Invalid Packet");
    return;
  }

  if (!queueClockJob(makeClockJob(ClockJobType::Alarm, data))) {
    emitMessage(
        ERROR_TAG,
        ERROR_BLE_JOB_QUEUE_FAILED,
        "Write Alarm: Queue Full");
  }
}

void SettingsWriteCallback::onWrite(
    NimBLECharacteristic* characteristic,
    NimBLEConnInfo& connection) {
  (void)connection;

  const std::string value = characteristic->getValue();
  const auto* data = reinterpret_cast<const uint8_t*>(value.data());

  if (value.size() != SETTINGS_PACKET_SIZE) {
    emitMessage(
        ERROR_TAG,
        ERROR_INVALID_PACKET_SIZE,
        "Write Settings: Invalid Size");
    return;
  }

  if (!isValidSettingsPacket(data, value.size())) {
    emitMessage(
        ERROR_TAG,
        ERROR_INVALID_PACKET,
        "Write Settings: Invalid Packet");
    return;
  }

  if (!queueClockJob(makeClockJob(ClockJobType::Settings, data))) {
    emitMessage(
        ERROR_TAG,
        ERROR_BLE_JOB_QUEUE_FAILED,
        "Write Settings: Queue Full");
  }
}
