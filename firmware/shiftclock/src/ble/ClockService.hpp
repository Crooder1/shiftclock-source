#pragma once

#include "BLEProtocol.hpp"

#include <NimBLEDevice.h>

NimBLEService* createClockService(NimBLEServer& server);
void deinitializeClockService();

NimBLECharacteristic* getMessageCharacteristic();

class AlarmWriteCallback final : public NimBLECharacteristicCallbacks {

  uint8_t selectedAlarmId = 0;

  void onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& connection) override;
  void onRead(NimBLECharacteristic* characteristic, NimBLEConnInfo& connection) override;
};

class SettingsCallback final : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& connection) override;
  void onRead(NimBLECharacteristic* characteristic, NimBLEConnInfo& connection) override;
};

void processAlarmWrite(const uint8_t (&packet)[ALARM_WRITE_PACKET_SIZE]);
void processSettingsWrite(const uint8_t (&packet)[SETTINGS_WRITE_PACKET_SIZE]);
