#include "Alarm.hpp"

#include <Preferences.h>
#include <cstring>
#include <vector>
#include <time.h>

Preferences alarm_preferences;

std::vector<Alarm> alarms;

Alarm::Alarm() : Alarm(0, 0, 0, 0, 0, 0) {}

Alarm::Alarm(
  uint8_t daysActive,
  uint32_t alarmSeconds,
  uint8_t tuneId,
  uint16_t alarmRamp,
  uint8_t volume,
  uint16_t autoDisableSeconds
)
  : days_active(daysActive),
    alarm_seconds(alarmSeconds),
    tune_id(tuneId),
    alarm_ramp(alarmRamp),
    volume(volume),
    auto_disable_seconds(autoDisableSeconds) {}

Alarm::Alarm(const uint8_t(&packet)[PACKED_ALARM_SIZE])
  : Alarm(
      packet[0],
      static_cast<uint32_t>(packet[1])
        | (static_cast<uint32_t>(packet[2]) << 8)
        | (static_cast<uint32_t>(packet[3]) << 16),
      packet[4],
      static_cast<uint16_t>(packet[5])
        | (static_cast<uint16_t>(packet[6]) << 8),
      packet[7],
      static_cast<uint16_t>(packet[8])
        | (static_cast<uint16_t>(packet[9]) << 8)) {}

void Alarm::pack(uint8_t(&packet)[PACKED_ALARM_SIZE]) const {
  packet[0] = this->days_active;
  packet[1] = (this->alarm_seconds & 0xFF);
  packet[2] = ((this->alarm_seconds >> 8) & 0xFF);
  packet[3] = ((this->alarm_seconds >> 16) & 0xFF);
  packet[4] = this->tune_id;
  packet[5] = (this->alarm_ramp & 0xFF);
  packet[6] = ((this->alarm_ramp >> 8) & 0xFF);
  packet[7] = this->volume;
  packet[8] = (this->auto_disable_seconds & 0xFF);
  packet[9] = ((this->auto_disable_seconds >> 8) & 0xFF);
}

bool Alarm::startPlayingTune() {

}

bool Alarm::stopPlayingTune() {

}

bool Alarm::isPlaying() const {
  return this->playing;
}

void packAlarm(const Alarm& alarm, uint8_t(&packet)[PACKED_ALARM_SIZE]) {
  alarm.pack(packet);
}

Alarm unpackAlarm(const uint8_t(&packet)[PACKED_ALARM_SIZE]) {
  return Alarm(packet);
}

bool createAlarm(
  Alarm& alarm, 
  uint8_t daysActive,
  uint32_t alarmSecond,
  uint8_t tuneId,
  uint16_t alarmRamp,
  uint8_t volume,
  uint16_t autoDisableSeconds
) {

  if (
    daysActive > ALARM_DAYS_ACTIVE_MAX || 
    alarmSecond > ALARM_SECONDS_OF_DAY_MAX ||
    tuneId > ALARM_TUNE_ID_MAX ||
    alarmRamp > ALARM_RAMP_DURATION_SECONDS_MAX ||
    volume > ALARM_VOLUME_MAX ||
    autoDisableSeconds > ALARM_AUTO_DISABLE_SECONDS_MAX
  ) {
    return false;
  }

  alarm = Alarm(
    daysActive,
    alarmSecond,
    tuneId,
    alarmRamp,
    volume,
    autoDisableSeconds);
  return true;
}

size_t getAlarmCount() {
  return alarms.size();
}

bool getAlarm(Alarm& alarm, uint8_t id) {

  if (id >= alarms.size()) return false;

  alarm = alarms.at(id);
  return true;
}

bool addAlarm(const Alarm& alarm) {

  if (alarms.size() >= MAX_ALARMS) return false;

  alarms.push_back(alarm);
  return true;
}

bool modifyAlarm(const Alarm& alarm, uint8_t id) {

  if (id >= alarms.size()) return false;

  alarms.at(id) = alarm;
  return true;
}

bool removeAlarm(uint8_t id) {

  if (id >= alarms.size()) return false;

  alarms.erase(alarms.begin() + id);
  return true;
}

void alarmTask(void* parameter) {

  time_t now = time(nullptr);
  struct tm local;
  localtime_r(&now, &local);

  uint32_t lastDaySeconds = local.tm_sec;

  Alarm* activeAlarm = nullptr;
  uint32_t alarmActiveEpochSeconds = 0;

  while (true) {
    
    now = time(nullptr);
    localtime_r(&now, &local);

    int32_t dayOfWeek = local.tm_wday;

    uint32_t daySeconds = local.tm_sec + local.tm_min * 60UL + local.tm_hour * 3600UL;
    uint32_t epochSeconds = (uint32_t)now;

    if (activeAlarm != nullptr) {
      if (epochSeconds - alarmActiveEpochSeconds > activeAlarm->auto_disable_seconds) {
        activeAlarm->stopPlayingTune();
        activeAlarm = nullptr;
        alarmActiveEpochSeconds = 0;
      }
    }

    for (Alarm alarm : alarms) {

      // alarm.isPlaying() should never br reached.
      if (activeAlarm != nullptr || alarm.isPlaying()) break;

      bool alarmActive = ((alarm.days_active >> dayOfWeek) & 1) == 1;
      if (!alarmActive) continue;

      if (lastDaySeconds <= alarm.alarm_seconds && alarm.alarm_seconds <= daySeconds) {
        alarm.startPlayingTune();
        activeAlarm = &alarm;
        alarmActiveEpochSeconds = epochSeconds;
      }
    }

    vTaskDelay(pdMS_TO_TICKS(1000));
  }

}

bool commitAlarms() {

  if (!alarm_preferences.begin(ALARM_PREFS_NAMESPACE, false)) {
    return false;
  }

  size_t bufferSize = alarms.size() * PACKED_ALARM_SIZE;
  uint8_t buffer[bufferSize];

  for (size_t x = 0; x < alarms.size(); x++) {

    uint8_t packedAlarm[PACKED_ALARM_SIZE];
    packAlarm(alarms.at(x), packedAlarm);

    for (size_t y = 0; y < PACKED_ALARM_SIZE; y++) {
      buffer[x * PACKED_ALARM_SIZE + y] = packedAlarm[y];
    }
  }

  size_t written = alarm_preferences.putBytes(ALARM_PREFS_KEY, buffer, bufferSize);

  alarm_preferences.end();

  if (written != bufferSize) {
    return false;
  }

  return true;
}

bool loadAlarms() {

  if (!alarm_preferences.begin(ALARM_PREFS_NAMESPACE, true)) {
    return false;
  }

  size_t bufferSize = alarm_preferences.getBytesLength(ALARM_PREFS_KEY);

  if (bufferSize % PACKED_ALARM_SIZE != 0) {
    alarm_preferences.end();
    return false;
  }

  if (bufferSize == 0) {
    alarm_preferences.end();
    return false;
  }

  size_t alarmCount = bufferSize / PACKED_ALARM_SIZE;

  if (alarmCount > MAX_ALARMS) {
    alarm_preferences.end();
    return false;
  }

  uint8_t buffer[bufferSize];

  size_t read = alarm_preferences.getBytes(ALARM_PREFS_KEY, buffer, bufferSize);
  alarm_preferences.end();

  if (read != bufferSize) {
    return false;
  }

  for (size_t x = 0; x < alarmCount; x++) {

    uint8_t alarmBuffer[PACKED_ALARM_SIZE];
    memcpy(alarmBuffer, buffer + x * PACKED_ALARM_SIZE, PACKED_ALARM_SIZE);

    Alarm unpacked = unpackAlarm(alarmBuffer);

    if (!modifyAlarm(unpacked, x)) {
      return false;
    }
  }

  return true;
}
