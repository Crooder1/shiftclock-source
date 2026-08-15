#pragma once

#include "tunes/TuneCatalogue.hpp"

#include <Arduino.h>

constexpr size_t MAX_ALARMS = 32;
constexpr size_t PACKED_ALARM_SIZE = 10;

constexpr uint32_t ALARM_ACTIVATE_WINDOW = 2000;

#define ALARM_PREFS_NAMESPACE "alarm"
#define ALARM_PREFS_KEY "alarms"

constexpr uint8_t ALARM_DAYS_ACTIVE_MAX = 0x7F;
constexpr uint32_t ALARM_SECONDS_OF_DAY_MAX = 86399;
constexpr uint8_t ALARM_TUNE_ID_MAX = MAX_TUNES - 1;
constexpr uint16_t ALARM_RAMP_DURATION_SECONDS_MAX = 600;
constexpr uint8_t ALARM_VOLUME_MAX = 100;
constexpr uint16_t ALARM_AUTO_DISABLE_SECONDS_MAX = 3600;

class Alarm {

private:
  bool playing = false;

public:
  uint8_t days_active;
  uint32_t alarm_seconds;
  uint8_t tune_id;
  uint16_t alarm_ramp;
  uint8_t volume;
  uint16_t auto_disable_seconds;

  Alarm();
  Alarm(
    uint8_t daysActive,
    uint32_t alarmSeconds,
    uint8_t tuneId,
    uint16_t alarmRamp,
    uint8_t volume,
    uint16_t autoDisableSeconds
  );
  Alarm(const uint8_t(&packet)[PACKED_ALARM_SIZE]);

  void pack(uint8_t(&packet)[PACKED_ALARM_SIZE]) const;
  bool startPlayingTune();
  bool stopPlayingTune();
  bool isPlaying() const;
};

void packAlarm(const Alarm& alarm, uint8_t(&packet)[PACKED_ALARM_SIZE]);
Alarm unpackAlarm(const uint8_t(&packet)[PACKED_ALARM_SIZE]);

bool createAlarm(
  Alarm& alarm, 
  uint8_t daysActive,
  uint32_t alarmSecond,
  uint8_t tuneId,
  uint16_t alarmRamp,
  uint8_t volume,
  uint16_t autoDisableSeconds
);
size_t getAlarmCount();
bool getAlarm(Alarm& alarm, uint8_t id);
bool addAlarm(const Alarm& alarm);
bool modifyAlarm(const Alarm& alarm, uint8_t id);
bool removeAlarm(uint8_t id);

bool loadAlarms();
bool commitAlarms();
