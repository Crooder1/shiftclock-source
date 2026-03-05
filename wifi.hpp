#pragma once

#include <Arduino.h>
#include <stdint.h>
#include <stddef.h>
#include <string>

// Wifi Credentials
#define WIFI_SSID "Crodphone"
#define WIFI_PASS "upetr187"

#define API_URL "https://aisenseapi.com/services/v1/timestamp"

extern bool wifi_initialized;
extern bool time_get_attempted;

void initWifi();
void stopWifi();
uint64_t getCurrentTime();
//std::string wl_status_to_string(wl_status_t);