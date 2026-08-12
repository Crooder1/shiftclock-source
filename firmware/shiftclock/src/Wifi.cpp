#include "Wifi.hpp"

#include <WiFi.h>
#include <time.h>

bool wifi_initialized = false;
bool time_configured = false;

void initWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting to Wifi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWifi Connected!");
  wifi_initialized = true;
}

void stopWifi() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF); 
  Serial.println("Wifi Disconnected!");
  wifi_initialized = false;
}

void initTime() {

  if (!wifi_initialized) {
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

  time_configured = true;
}
