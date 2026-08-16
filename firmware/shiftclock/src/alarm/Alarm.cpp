#include "Alarm.hpp"

#include <Preferences.h>
#include <cstring>
#include <vector>
#include <time.h>
#include <ESP_I2S.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>

namespace {

Preferences alarm_preferences;

I2SClass I2S;
bool i2SInitialized = false;

std::vector<Alarm> alarms;

TaskHandle_t alarmTask = nullptr;

} // namespace

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

void alarmWorker(void* parameter) {

  time_t now = time(nullptr);
  struct tm local;
  localtime_r(&now, &local);

  uint32_t lastDaySeconds = local.tm_sec + local.tm_min * 60UL + local.tm_hour * 3600UL;

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
        activeAlarm = nullptr;
        alarmActiveEpochSeconds = 0;
      } else if (i2SInitialized) {
        
        AlarmTune tune;
        if (getTune(tune, activeAlarm->tune_id)) {
          writeAudio(tune.data, tune.data_length);
        }
      }
    }

    for (Alarm& alarm : alarms) {

      if (activeAlarm != nullptr) break;

      bool alarmActive = ((alarm.days_active >> dayOfWeek) & 1) == 1;
      if (!alarmActive) continue;

      if (lastDaySeconds <= alarm.alarm_seconds && alarm.alarm_seconds <= daySeconds) {
        activeAlarm = &alarm;
        alarmActiveEpochSeconds = epochSeconds;
      }
    }

    lastDaySeconds = daySeconds;
    vTaskDelay(pdMS_TO_TICKS(1000));
  }

}

bool initializeAlarms() {

  if (!loadAlarms()) {
    return false;
  }

  if (!initializeI2S()) {
    return false;
  }

  if (alarmTask != nullptr) return true;

  if (xTaskCreate(
      alarmWorker,
      "alarm_worker",
      ALARM_STACK_DEPTH,
      nullptr,
      1,
      &alarmTask
  ) != pdPASS) {
    Serial.println("Alarm task creation failed");
    return false;
  }

  return true;
}

bool initializeI2S() {

  if (i2SInitialized) return true;

  I2S.setPins(BCLK_PIN, WS_PIN, DOUT_PIN);

  if (!I2S.begin(
      I2S_MODE_STD,
      16000,
      I2S_DATA_BIT_WIDTH_16BIT,
      I2S_SLOT_MODE_MONO
  )) return false;

  i2SInitialized = true;
  return true;
}

void writeAudio(const uint8_t* audio, size_t audioLength) {

  size_t offset = 0;

  while(offset < audioLength) {

    size_t count = min(AUDIO_CHUNK_SIZE, audioLength - offset);

    size_t written = I2S.write(
      audio + offset,
      count
    );

    if (written == 0) {
      break;
    }

    offset += written;
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

  if (!alarm_preferences.isKey(ALARM_PREFS_KEY)) {
    alarm_preferences.end();
    Serial.println("Alarms Never Stored. Skipping...");
    return true;
  }

  size_t bufferSize = alarm_preferences.getBytesLength(ALARM_PREFS_KEY);

  if (bufferSize == 0) {
    alarm_preferences.end();
    Serial.println("No Alarms Stored. Skipping...");
    return true;
  }

  if (bufferSize % PACKED_ALARM_SIZE != 0) {
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

  alarms.clear();

  for (size_t x = 0; x < alarmCount; x++) {

    uint8_t alarmBuffer[PACKED_ALARM_SIZE];
    memcpy(alarmBuffer, buffer + x * PACKED_ALARM_SIZE, PACKED_ALARM_SIZE);

    Alarm unpacked = unpackAlarm(alarmBuffer);

    if (!addAlarm(unpacked)) {
      return false;
    }

  }

  return true;
}
