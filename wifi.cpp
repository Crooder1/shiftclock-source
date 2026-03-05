#include "wifi.hpp"
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

bool wifi_initialized = false;
bool time_get_attempted = false;

void initWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  Serial.print("Connecting to WiFi");
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
}

uint64_t getCurrentTime() {

  if (!wifi_initialized) {
    Serial.println("ERROR: Wifi not initialized.");
    return 0;
  }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("ERROR: Wifi not connected.");
    return 0;
  }

  time_get_attempted = true;

  WiFiClientSecure client; 
  client.setInsecure();
  client.setTimeout(10000L);

  HTTPClient http;
  http.begin(client, API_URL);
  int httpCode = http.GET();

  if (httpCode > 0) {
    Serial.printf("HTTP Response Code: %d\n", httpCode);
    String payload = http.getString();
    Serial.printf("Payload: %s\n", payload.c_str());

    http.end();

    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, payload.c_str());
    if (error) {
      Serial.print("Failed to parse JSON: ");
      Serial.println(error.f_str());
      http.end();
      return 0;
    }

    uint64_t current_seconds = doc["timestamp"];

    return current_seconds * 1000L;

  } else {
    Serial.printf("HTTP GET failed, error:%d %s\n", httpCode, http.errorToString(httpCode).c_str());
  }

  http.end();

  return 0;
}

/* wl_status_to_string(wl_status_t status) {
  switch (status) {
    case WL_NO_SHIELD: return "WL_NO_SHIELD";
    case WL_IDLE_STATUS: return "WL_IDLE_STATUS";
    case WL_NO_SSID_AVAIL: return "WL_NO_SSID_AVAIL";
    case WL_SCAN_COMPLETED: return "WL_SCAN_COMPLETED";
    case WL_CONNECTED: return "WL_CONNECTED";
    case WL_CONNECT_FAILED: return "WL_CONNECT_FAILED";
    case WL_CONNECTION_LOST: return "WL_CONNECTION_LOST";
    case WL_DISCONNECTED: return "WL_DISCONNECTED";
    case WL_WRONG_PASSWORD: return "WL_WRONG_PASSWORD";
    default: return "UNKNOWN_WL_STATUS";
  }
}*/