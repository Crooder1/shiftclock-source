#include "Wifi.hpp"

#include "Settings.hpp"

#include "esp_timer.h"

#include <WiFi.h>
#include <Preferences.h>
#include <time.h>

Preferences wifi_preferences;

bool wifi_initialized = false;
bool time_initialized = false;

bool initWifi() {

  struct WifiCredentials creds;

  if (!getWifiCredentials(creds)) {
    return false;
  }

  return connectWifi(creds);
}

bool connectWifi(const WifiCredentials& creds) {

  wifi_initialized = false;

  WiFi.mode(WIFI_STA);
  WiFi.begin(creds.ssid.c_str(), creds.password.c_str());

  const int64_t startTimestamp = esp_timer_get_time();

  Serial.print("Connecting to Wifi");
  while (WiFi.status() != WL_CONNECTED) {

    if (esp_timer_get_time() - startTimestamp >= WIFI_TIMEOUT_MILLIS * 1000LL) {
      return false;
    }

    Serial.print(".");
    delay(500);
  }

  Serial.println("\nWifi Connected!");
  wifi_initialized = true;
  return true;
}

void stopWifi() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF); 
  Serial.println("Wifi Disconnected!");
  wifi_initialized = false;
}

bool getWifiCredentials(WifiCredentials& creds) {

  if (!wifi_preferences.begin(WIFI_PREFS_NAMESPACE, true)) {
    Serial.println("Wifi Preferences Failed To Open");
    return false;
  }

  if (
    wifi_preferences.getType(WIFI_PREFS_SSID_KEY) != PT_STR
    || wifi_preferences.getType(WIFI_PREFS_PASSWORD_KEY) != PT_STR
  ) {
    Serial.println("SSID or password missing.");
    wifi_preferences.end();
    return false;
  }

  const size_t ssidLen = wifi_preferences.getStringLength(WIFI_PREFS_SSID_KEY);
  const size_t passwordLen = wifi_preferences.getStringLength(WIFI_PREFS_PASSWORD_KEY);

  if (ssidLen <= 0 || passwordLen < 0) {
    Serial.println("SSID or password missing.");
    wifi_preferences.end();
    return false;
  }

  std::string ssid;
  std::string password;

  ssid.resize(ssidLen);
  password.resize(passwordLen);

  if (!wifi_preferences.getString(WIFI_PREFS_SSID_KEY, ssid.data(), ssidLen)) {
    Serial.println("Failed to load SSID");
    wifi_preferences.end();
    return false;
  }

  if (!wifi_preferences.getString(WIFI_PREFS_PASSWORD_KEY, password.data(), passwordLen)) {
    Serial.println("Failed to load Password");
    wifi_preferences.end();
    return false;
  }

  wifi_preferences.end();

  ssid.resize(ssidLen - 1);
  password.resize(passwordLen - 1);

  creds.ssid = ssid;
  creds.password = password;

  return true;
}

bool setWifiCredentials(const WifiCredentials& creds) {

  if (!connectWifi(creds)) {
    return false;
  }

  if (!wifi_preferences.begin(WIFI_PREFS_NAMESPACE, false)) {
    Serial.println("Wifi Preferences Failed To Open");
    return false;
  }

  if (wifi_preferences.getType(WIFI_PREFS_SSID_KEY) != PT_STR) {
    wifi_preferences.remove(WIFI_PREFS_SSID_KEY);
  }

  if (wifi_preferences.getType(WIFI_PREFS_PASSWORD_KEY) != PT_STR) {
    wifi_preferences.remove(WIFI_PREFS_PASSWORD_KEY);
  }

  if (wifi_preferences.putString(WIFI_PREFS_SSID_KEY, creds.ssid.c_str()) != creds.ssid.size()) {
    Serial.println("Failed to commit ssid");
    wifi_preferences.end();
    return false;
  }

  if (wifi_preferences.putString(WIFI_PREFS_PASSWORD_KEY, creds.password.c_str()) != creds.password.size()) {
    Serial.println("Failed to commit password.");
    wifi_preferences.end();
    return false;
  }

  wifi_preferences.end();

  return true;
}

bool clearWifiCredentials() {

  if (!wifi_preferences.begin(WIFI_PREFS_NAMESPACE, false)) {
    Serial.println("Wifi Preferences Failed To Open");
    return false;
  }

  bool success = true;

  if (!wifi_preferences.remove(WIFI_PREFS_SSID_KEY)) {
    Serial.println("Failed to clear ssid.");
    success = false;
  }

  if (!wifi_preferences.remove(WIFI_PREFS_PASSWORD_KEY)) {
    Serial.println("Failed to clear password.");
    success = false;
  }

  wifi_preferences.end();

  return success;
}

void initTime() {

  if (!wifi_initialized || time_initialized) {
    return;
  }

  configTime(
    0,                  // GMT offset
    0,                  // daylight offset
    "pool.ntp.org"
  );

  time_t now = time(nullptr);

  Serial.print("Waiting for NTP");
  while (now < 1000000000) {
    delay(100);
    Serial.print(".");
    now = time(nullptr);
  }

  Serial.println();
  Serial.printf("Current Unix Time: %llu\n", (uint64_t)now);

  setTimezoneOffset();

  time_initialized = true;
}

void setTimezoneOffset() {
  char tz[16];

  // POSIX TZ signs are reversed
  snprintf(tz, sizeof(tz), "UTC%+d", -getSetting(TIMEZONE_SETTING));

  setenv("TZ", tz, 1);
  tzset();
}
