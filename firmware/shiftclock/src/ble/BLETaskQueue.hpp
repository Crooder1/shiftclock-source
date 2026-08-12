#pragma once

#include "BLEProtocol.hpp"

#include <cstddef>
#include <cstdint>

constexpr uint8_t BLEQUEUE_INIT_SUCCESS = 0x00;
constexpr uint8_t BLEQUEUE_CREATE_FAIL = 0x01;
constexpr uint8_t BLEQUEUE_TASK_FAIL = 0x02;

constexpr uint32_t CLOCK_STACK_DEPTH = 4096;
constexpr uint8_t CLOCK_QUEUE_SIZE = 4;

enum class ClockJobType : uint8_t {
  TaskShutdown,
  Alarm,
  Settings
};

struct ClockJob {
  ClockJobType type;
  union {
    uint8_t alarm[ALARM_PACKET_SIZE];
    uint8_t settings[SETTINGS_WRITE_PACKET_SIZE];
  } packet;
};

uint8_t initializeBLETaskQueue();
bool deinitializeBLETaskQueue();
bool queueClockJob(const ClockJob& job);
