#pragma once

#include <NimBLEDevice.h>

NimBLEService* createClockService(NimBLEServer& server);
void deinitializeClockService();

NimBLECharacteristic* getMessageCharacteristic();

class AlarmWriteCallback final : public NimBLECharacteristicCallbacks {
  void onWrite(
      NimBLECharacteristic* characteristic,
      NimBLEConnInfo& connection) override;
};

class SettingsWriteCallback final : public NimBLECharacteristicCallbacks {
  void onWrite(
      NimBLECharacteristic* characteristic,
      NimBLEConnInfo& connection) override;
};
