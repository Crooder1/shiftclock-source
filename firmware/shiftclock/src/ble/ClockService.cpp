#include "ClockService.hpp"

#include "../alarm/Alarm.hpp"
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
    NIMBLE_PROPERTY::WRITE_NR | 
    NIMBLE_PROPERTY::READ
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
  const size_t dataLength = value.size();

  if (value.size() != ALARM_WRITE_PACKET_SIZE) {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET_SIZE, "Write Alarm: Invalid Size");
    return;
  }

  if (dataLength != ALARM_WRITE_PACKET_SIZE || !hasSupportedHeader(data, dataLength)) {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Write Alarm: Invalid Packet");
    return;
  }

  const uint8_t command = readByte(data, dataLength, ALARM_COMMAND_OFFSET);

  if (command == ALARM_READ_COMMAND) {
    
    const uint8_t alarmId = readByte(data, dataLength, ALARM_ID_OFFSET);

    if (alarmId >= getAlarmCount()) {
      emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Invalid Alarm id");
      return;
    }

    selectedAlarmId = alarmId;

    emitMessage(INFO_TAG, INFO_OPERATION_SUCCEEDED, "Alarm Selection Succeeded");
    return;
  }

  ClockJob clockJob;
  clockJob.type = ClockJobType::Alarm;
  memcpy(clockJob.packet.alarm, data, dataLength);

  if (!queueClockJob(clockJob)) {
    emitMessage(ERROR_TAG, ERROR_BLE_JOB_QUEUE_FAILED, "Write Alarm: Queue Full");
  }
}

void AlarmWriteCallback::onRead(NimBLECharacteristic* characteristic, NimBLEConnInfo& connection) {
  (void)connection;

  Alarm alarm;
  if (!getAlarm(alarm, selectedAlarmId)) {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Invalid Alarm Id");
    return;
  }

  uint8_t packedAlarm[PACKED_ALARM_SIZE];
  packAlarm(alarm, packedAlarm);

  uint8_t packet[ALARM_READ_PACKET_SIZE];
  packet[0] = PROTOCOL_HEADER;
  packet[1] = selectedAlarmId;
  memcpy(packet + 2, packedAlarm, sizeof(packedAlarm));

  characteristic->setValue(packet, sizeof(packet));
}

void SettingsCallback::onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& connection) {
  (void)connection;

  const std::string value = characteristic->getValue();
  const auto* data = reinterpret_cast<const uint8_t*>(value.data());
  const size_t dataLength = value.size();

  if (value.size() != SETTINGS_WRITE_PACKET_SIZE) {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET_SIZE, "Write Settings: Invalid Size");
    return;
  }

  if (dataLength != SETTINGS_WRITE_PACKET_SIZE || !hasSupportedHeader(data, dataLength)) {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Write Settings: Invalid Packet");
    return;
  }

  ClockJob clockJob;
  clockJob.type = ClockJobType::Settings;
  memcpy(clockJob.packet.settings, data, dataLength);

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

void processAlarmWrite(const uint8_t (&packet)[ALARM_WRITE_PACKET_SIZE]) {
  
  const uint8_t command = readByte(packet, sizeof(packet), ALARM_COMMAND_OFFSET);
  const uint8_t alarmId = readByte(packet, sizeof(packet), ALARM_ID_OFFSET);
  const uint8_t daysActive = readByte(packet, sizeof(packet), ALARM_DAYS_ACTIVE_OFFSET);
  const uint32_t alarmSecond = readInt(packet, sizeof(packet), ALARM_SECONDS_OF_DAY_OFFSET, 3);
  const uint8_t tuneId = readByte(packet, sizeof(packet), ALARM_TUNE_ID_OFFSET);
  const uint16_t alarmRamp = readInt(packet, sizeof(packet), ALARM_RAMP_DURATION_OFFSET, 2);
  const uint8_t volume = readByte(packet, sizeof(packet), ALARM_VOLUME_OFFSET);
  const uint16_t autoDisableSeconds = readInt(
    packet,
    sizeof(packet),
    ALARM_AUTO_DISABLE_SECONDS_OFFSET,
    2);

  if (command == ALARM_ADD_COMMAND) {
    Alarm alarm;
    if (!createAlarm(
        alarm,
        daysActive,
        alarmSecond,
        tuneId,
        alarmRamp,
        volume,
        autoDisableSeconds)) {
      emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Invalid Alarm");
      return;
    }

    if (!addAlarm(alarm)) {
      emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Alarm Limit Reached");
      return;
    }
  } else if (command == ALARM_MODIFY_COMMAND) {
    Alarm alarm;
    if (!createAlarm(
        alarm,
        daysActive,
        alarmSecond,
        tuneId,
        alarmRamp,
        volume,
        autoDisableSeconds)) {
      emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Invalid Alarm");
      return;
    }

    if (!modifyAlarm(alarm, alarmId)) {
      emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Invalid Alarm Id");
      return;
    }
  } else if (command == ALARM_REMOVE_COMMAND) {
    if (!removeAlarm(alarmId)) {
      emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Invalid Alarm Id");
      return;
    }
  } else {
    emitMessage(ERROR_TAG, ERROR_INVALID_PACKET, "Invalid Command");
    return;
  }

  emitMessage(INFO_TAG, INFO_OPERATION_SUCCEEDED, "Alarm Write Succeeded");
}

void processSettingsWrite(const uint8_t (&packet)[SETTINGS_WRITE_PACKET_SIZE]) {

  const uint8_t settingId = readByte(packet, sizeof(packet), SETTINGS_ID_OFFSET);
  const uint8_t settingValue = readByte(packet, sizeof(packet), SETTINGS_VALUE_OFFSET);

  if (settingId == 0xFF && settingValue == 0xFF) {
    if (commitSettings()) {
      emitMessage(INFO_TAG, INFO_OPERATION_SUCCEEDED, "Settings Write Succeeded");
    }
    return;
  } else if (settingId == 0xFF && settingValue == 0xFE) {
    if (loadSettings()) {
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
