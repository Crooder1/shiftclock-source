#pragma once

#include "../Generated.hpp"

#include <Arduino.h>

constexpr uint32_t WIFI_TIMEOUT_MILLIS = 20000;

extern bool wifi_initialized;
extern bool time_get_attempted;

void initWifi();
void stopWifi();

void initTime();
