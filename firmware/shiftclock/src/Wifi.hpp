#pragma once

#include <string>
#include <Arduino.h>

constexpr uint32_t WIFI_TIMEOUT_MILLIS = 20000;

extern bool wifi_initialized;
extern bool time_initialized;

#define WIFI_PREFS_NAMESPACE "wifi"
#define WIFI_PREFS_SSID_KEY "ssid"
#define WIFI_PREFS_PASSWORD_KEY "pass"

struct WifiCredentials {
  std::string ssid;
  std::string password;
};

bool initWifi();
bool connectWifi(const WifiCredentials& creds);
void stopWifi();

bool getWifiCredentials(WifiCredentials& creds);
bool setWifiCredentials(const WifiCredentials& creds);
bool clearWifiCredentials();

void initTime();
void setTimezoneOffset();
