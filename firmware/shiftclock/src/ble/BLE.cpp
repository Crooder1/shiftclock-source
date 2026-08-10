#include "BLE.hpp"

#include "BLEProtocol.hpp"
#include "BLETaskQueue.hpp"
#include "ClockService.hpp"

#include <Arduino.h>
#include <NimBLEDevice.h>

#include <algorithm>
#include <cstring>

namespace {

NimBLEServer* server = nullptr;
uint16_t connectionHandle = BLE_HS_CONN_HANDLE_NONE;
bool bleInitialized = false;
bool deviceConnected = false;

class ClockServerCallbacks final : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* connectedServer, NimBLEConnInfo& connection) override {
    if (connectionHandle != BLE_HS_CONN_HANDLE_NONE) {
      connectedServer->disconnect(connection.getConnHandle());
      return;
    }

    connectionHandle = connection.getConnHandle();
    deviceConnected = true;
  }

  void onDisconnect(
      NimBLEServer* disconnectedServer,
      NimBLEConnInfo& connection,
      int reason) override {
    (void)disconnectedServer;
    (void)reason;

    if (connection.getConnHandle() != connectionHandle) return;

    connectionHandle = BLE_HS_CONN_HANDLE_NONE;
    deviceConnected = false;
  }

  void onMTUChange(uint16_t mtu, NimBLEConnInfo& connection) override {
    Serial.printf(
        "BLE MTU changed: handle=%u, MTU=%u\n",
        connection.getConnHandle(),
        mtu);
  }
};

ClockServerCallbacks serverCallbacks;

} // namespace

bool initializeBLE() {
  if (bleInitialized) return true;

  if (initializeBLETaskQueue() != BLEQUEUE_INIT_SUCCESS) {
    Serial.println("BLE queue setup failed");
    return false;
  }

  NimBLEDevice::init(CLOCK_NAME);
  if (!NimBLEDevice::setMTU(PREFERRED_ATT_MTU)) {
    Serial.println("BLE preferred MTU setup failed");
    deinitializeBLETaskQueue();
    NimBLEDevice::deinit(true);
    return false;
  }

  server = NimBLEDevice::createServer();
  if (server == nullptr) {
    Serial.println("BLE server creation failed");
    deinitializeBLETaskQueue();
    NimBLEDevice::deinit(true);
    return false;
  }

  server->setCallbacks(&serverCallbacks);
  server->advertiseOnDisconnect(true);

  if (createClockService(*server) == nullptr) {
    Serial.println("Clock service creation failed");
    deinitializeBLETaskQueue();
    NimBLEDevice::deinit(true);
    server = nullptr;
    return false;
  }

  if (!startAdvertising()) {
    Serial.println("BLE advertising failed");
    deinitializeClockService();
    deinitializeBLETaskQueue();
    NimBLEDevice::deinit(true);
    server = nullptr;
    return false;
  }

  bleInitialized = true;
  Serial.println("BLE setup complete");
  return true;
}

bool deinitializeBLE() {
  if (!deinitializeBLETaskQueue()) {
    Serial.println("BLE queue shutdown failed");
    return false;
  }

  deinitializeClockService();

  if (bleInitialized && !NimBLEDevice::deinit(true)) {
    Serial.println("BLE stack shutdown failed");
    return false;
  }

  server = nullptr;
  connectionHandle = BLE_HS_CONN_HANDLE_NONE;
  deviceConnected = false;
  bleInitialized = false;

  Serial.println("BLE shutdown complete");
  return true;
}

bool startAdvertising() {
  NimBLEAdvertising* advertising = NimBLEDevice::getAdvertising();
  if (advertising == nullptr) return false;

  advertising->clearData();

  NimBLEAdvertisementData advertisementData;
  NimBLEAdvertisementData scanResponseData;

  if (!advertisementData.setFlags(
      BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP)) {
    return false;
  }
  if (!advertisementData.addServiceUUID(NimBLEUUID(CLOCK_SERVICE_UUID))) {
    return false;
  }
  if (!scanResponseData.setName(CLOCK_NAME)) return false;

  advertising->enableScanResponse(true);
  if (!advertising->setAdvertisementData(advertisementData)) return false;
  if (!advertising->setScanResponseData(scanResponseData)) return false;

  return advertising->start();
}

void disconnectClient() {
  if (
    !bleInitialized
    || server == nullptr
    || connectionHandle == BLE_HS_CONN_HANDLE_NONE
  ) return;

  if (!server->disconnect(connectionHandle)) {
    Serial.println("BLE client disconnect failed");
    emitMessage(
        ERROR_TAG,
        ERROR_BLE_DISCONNECT_FAILED,
        "BLE client disconnect failed");
  }
}

void emitMessage(
    uint8_t type,
    uint8_t code,
    const std::string& description) {
  Serial.printf("(%u:%u) %s\n", type, code, description.c_str());

  if (!bleInitialized || !deviceConnected) return;

  NimBLECharacteristic* message = getMessageCharacteristic();
  if (message == nullptr) return;

  uint8_t packet[MESSAGE_PACKET_SIZE] = {0};
  packet[HEADER_OFFSET] = PROTOCOL_HEADER;
  packet[MESSAGE_TYPE_OFFSET] = type;
  packet[MESSAGE_CODE_OFFSET] = code;

  const size_t descriptionLength = std::min(
      description.size(),
      MESSAGE_DESCRIPTION_SIZE - 1);
  memcpy(
      packet + MESSAGE_DESCRIPTION_OFFSET,
      description.data(),
      descriptionLength);

  message->setValue(packet, sizeof(packet));
  message->notify();
}
