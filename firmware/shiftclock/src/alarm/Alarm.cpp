#include "Alarm.hpp"
#include "AudioCommandQueue.hpp"

#include "../Settings.hpp"

#include <optional>
#include <Preferences.h>
#include <cstring>
#include <mutex>
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
std::mutex alarmsMutex;

bool hasActiveAlarm = false;

TaskHandle_t alarmTask = nullptr;

constexpr size_t AUDIO_COMMAND_QUEUE_SIZE = 4;
AudioCommandQueue<AUDIO_COMMAND_QUEUE_SIZE> audioCommands;
std::mutex audioCommandsMutex;

bool queueAudioCommand(const AudioCommand& command) {
  if (alarmTask == nullptr) return false;

  {
    std::lock_guard<std::mutex> lock(audioCommandsMutex);
    if (!audioCommands.pushPlay(command)) return false;
  }

  xTaskNotifyGive(alarmTask);
  return true;
}

bool takeAudioCommand(AudioCommand& command) {
  std::lock_guard<std::mutex> lock(audioCommandsMutex);
  return audioCommands.pop(command);
}

bool hasPendingAudioCommand() {
  std::lock_guard<std::mutex> lock(audioCommandsMutex);
  return !audioCommands.empty();
}

// Returns true for finished, false when a newer audio command is pending.
bool writeAudio(
  const uint8_t* audio,
  size_t audioLength,
  uint8_t initialVolume,
  uint8_t finalVolume
);

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
  std::lock_guard<std::mutex> lock(alarmsMutex);
 
  return alarms.size();
}

bool getAlarm(Alarm& alarm, uint8_t id) {
  std::lock_guard<std::mutex> lock(alarmsMutex);

  if (id >= alarms.size()) return false;

  alarm = alarms.at(id);

  return true;
}

bool addAlarm(const Alarm& alarm) {
  std::lock_guard<std::mutex> lock(alarmsMutex);

  if (alarms.size() >= MAX_ALARMS) return false;

  alarms.push_back(alarm);

  Serial.println("Alarm Added");

  return true;
}

bool modifyAlarm(const Alarm& alarm, uint8_t id) {
  std::lock_guard<std::mutex> lock(alarmsMutex);

  if (id >= alarms.size()) return false;
  
  alarms.at(id) = alarm;

  Serial.println("Alarm Modified");

  return true;
}

bool removeAlarm(uint8_t id) {
  std::lock_guard<std::mutex> lock(alarmsMutex);

  if (id >= alarms.size()) return false;

  alarms.erase(alarms.begin() + id);

  Serial.println("Alarm Removed");

  return true;
}

bool isAlarmActive() {
  return hasActiveAlarm;
}

void alarmWorker(void* parameter) {

  time_t now = time(nullptr);
  struct tm local;
  localtime_r(&now, &local);

  uint32_t lastDaySeconds = local.tm_sec + local.tm_min * 60UL + local.tm_hour * 3600UL;

  std::optional<Alarm> activeAlarm;
  uint32_t alarmActiveEpochSeconds = 0;

  while (true) {
    AudioCommand audioCommand;
    if (takeAudioCommand(audioCommand)) {
      if (activeAlarm.has_value()) {
        Serial.println("Alarm Reset");
        hasActiveAlarm = false;
        activeAlarm.reset();
        alarmActiveEpochSeconds = 0;
      }

      if (audioCommand.type == AudioCommandType::PlayTune) {
        AlarmTune tune;
        if (getTune(tune, audioCommand.tuneId)) {
          writeAudio(tune.data, tune.data_length, 100, 100);
        }

        if (audioCommand.onComplete != nullptr) {
          audioCommand.onComplete();
        }
      }

      continue;
    }
    
    now = time(nullptr);
    localtime_r(&now, &local);

    int32_t dayOfWeek = local.tm_wday;

    uint32_t daySeconds = local.tm_sec + local.tm_min * 60UL + local.tm_hour * 3600UL;
    uint32_t epochSeconds = (uint32_t)now;

    // Check active alarms
    {
      std::lock_guard<std::mutex> lock(alarmsMutex);

      for (size_t x = 0; x < std::min(MAX_ALARMS, alarms.size()); x++) {

        if (activeAlarm.has_value()) break;

        Alarm alarm = alarms.at(x);

        bool alarmActive = ((alarm.days_active >> dayOfWeek) & 1) == 1;
        if (!alarmActive) continue;

        if (lastDaySeconds <= alarm.alarm_seconds && alarm.alarm_seconds <= daySeconds) {
          Serial.println("Alarm Active");
          hasActiveAlarm = true;
          activeAlarm = alarm;
          alarmActiveEpochSeconds = epochSeconds;
        }
      }
    }

    // Play audio
    if (activeAlarm.has_value()) {

      uint32_t elapsedEpochSeconds = epochSeconds - alarmActiveEpochSeconds;

      if (activeAlarm->auto_disable_seconds > 0 && elapsedEpochSeconds > activeAlarm->auto_disable_seconds) {
        Serial.println("Alarm Timed Out");
        hasActiveAlarm = false;
        activeAlarm.reset();
        alarmActiveEpochSeconds = 0;
      } else if (i2SInitialized) {
        
        AlarmTune tune;

        if (getTune(tune, activeAlarm->tune_id)) {
          
          uint8_t initialVolume;
          uint8_t finalVolume;

          // no ramp
          if (activeAlarm->alarm_ramp == 0)  {
            initialVolume = activeAlarm->volume;
            finalVolume = activeAlarm->volume;
          // ramp
          } else {
            initialVolume = activeAlarm->volume * std::clamp((float)elapsedEpochSeconds / (float)activeAlarm->alarm_ramp, 0.0f, 1.0f);
            finalVolume = activeAlarm->volume * std::clamp((elapsedEpochSeconds * 1000.0f + getTuneDurationMs(tune)) / (activeAlarm->alarm_ramp * 1000.0f), 0.0f, 1.0f);
          }

          bool cancelled = !writeAudio(tune.data, tune.data_length, initialVolume, finalVolume);

          if (cancelled) {
            Serial.println("Alarm Reset");
            hasActiveAlarm = false;
            activeAlarm.reset();
          }
        }
      }
    }

    lastDaySeconds = daySeconds;
    ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(1000));
  }
}

bool initializeAlarms() {

  if (!initializeI2S()) {
    return false;
  }

  if (alarmTask != nullptr) return true;

  loadAlarms();

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

namespace {

bool writeAudio(
  const uint8_t* audio,
  size_t audioLength,
  uint8_t initialVolume,
  uint8_t finalVolume
) {

  size_t offset = 0;
  uint8_t audioBuffer[AUDIO_CHUNK_SIZE];

  Serial.println("Writing Audio");

  while(offset < audioLength) {

    if (hasPendingAudioCommand()) {
      return false;
    }

    size_t count = std::min(AUDIO_CHUNK_SIZE, audioLength - offset);
    
    float playbackProgress = ((float)offset) / ((float)(audioLength));
    float rampVolume = ((1 - playbackProgress) * (float)initialVolume) + (playbackProgress * (float)finalVolume); 
    float audioVolume = std::clamp(rampVolume / 100.0f * getSetting(VOLUME_SETTING) / 100.0f, 0.0f, 1.0f);

    // scale as uint16_t
    for (size_t x = 0; x < count; x += 2) {

      int16_t sample = ((int16_t)(audio[offset + x]) + (int16_t)(audio[offset + x + 1] << 8)) * audioVolume;

      audioBuffer[x] = (sample) & 0xFF;
      audioBuffer[x + 1] = (sample >> 8) & 0xFF;
    }

    size_t written = I2S.write(
      audioBuffer,
      count
    );

    if (written == 0) {
      return true;
    }

    offset += written;
  }

  return true;
}

} // namespace

bool queueTunePreview(uint8_t tuneId, AudioCompletionCallback onComplete) {
  if (tuneId >= getTuneCount()) return false;
  return queueAudioCommand({AudioCommandType::PlayTune, tuneId, onComplete});
}

bool cancelAudio() {
  if (alarmTask == nullptr) return false;

  bool queued;
  {
    std::lock_guard<std::mutex> lock(audioCommandsMutex);
    queued = audioCommands.pushStop();
  }

  if (!queued) return false;

  xTaskNotifyGive(alarmTask);
  return true;
}

bool commitAlarms() {
  std::lock_guard<std::mutex> lock(alarmsMutex);

  if (!alarm_preferences.begin(ALARM_PREFS_NAMESPACE, false)) {
    return false;
  }

  if (alarms.empty()) {
    const bool cleared = !alarm_preferences.isKey(ALARM_PREFS_KEY)
      || alarm_preferences.remove(ALARM_PREFS_KEY);
    alarm_preferences.end();
    return cleared;
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
    Serial.println("Alarm Preferences Failed To Open.");
    return false;
  }

  if (!alarm_preferences.isKey(ALARM_PREFS_KEY)) {
    alarm_preferences.end();
    {
      std::lock_guard<std::mutex> lock(alarmsMutex);
      alarms.clear();
    }
    Serial.println("Alarms Never Stored.");
    return true;
  }

  size_t bufferSize = alarm_preferences.getBytesLength(ALARM_PREFS_KEY);

  if (bufferSize == 0) {
    alarm_preferences.end();
    {
      std::lock_guard<std::mutex> lock(alarmsMutex);
      alarms.clear();
    }
    Serial.println("No Alarms Stored.");
    return true;
  }

  if (bufferSize % PACKED_ALARM_SIZE != 0) {
    alarm_preferences.end();
    Serial.println("Invalid Alarm Array Length.");
    return false;
  }

  size_t alarmCount = bufferSize / PACKED_ALARM_SIZE;

  if (alarmCount > MAX_ALARMS) {
    alarm_preferences.end();
    Serial.println("Max Alarm Count Exceeded.");
    return false;
  }

  uint8_t buffer[bufferSize];

  size_t read = alarm_preferences.getBytes(ALARM_PREFS_KEY, buffer, bufferSize);
  alarm_preferences.end();

  if (read != bufferSize) {
    Serial.println("Invalid Alarm Read Length");
    return false;
  }

  {
    std::lock_guard<std::mutex> lock(alarmsMutex);

    alarms.clear();

    for (size_t x = 0; x < std::min(alarmCount, MAX_ALARMS); x++) {

      uint8_t alarmBuffer[PACKED_ALARM_SIZE];
      memcpy(alarmBuffer, buffer + x * PACKED_ALARM_SIZE, PACKED_ALARM_SIZE);

      Alarm unpacked = unpackAlarm(alarmBuffer);
      alarms.push_back(unpacked);

    }

  } // alarmsMutex

  return true;
}
