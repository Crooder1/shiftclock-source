#include <array>
#include <cassert>
#include <cstddef>
#include <cstdint>

#include "BLETaskQueue.hpp"

bool isValidAlarmPacket(const uint8_t* data, size_t length);
bool isValidSettingsPacket(const uint8_t* data, size_t length);

int main() {
  const std::array<uint8_t, 9> zeroAlarm{};
  assert(isValidAlarmPacket(zeroAlarm.data(), zeroAlarm.size()));

  const std::array<uint8_t, 9> alarm{
      0,
      0x7F,
      0x7F, 0x51, 0x01,
      1,
      0x58, 0x02,
      100,
  };
  assert(isValidAlarmPacket(alarm.data(), alarm.size()));

  auto invalidDays = alarm;
  invalidDays[1] = 0x80;
  assert(!isValidAlarmPacket(invalidDays.data(), invalidDays.size()));

  auto invalidSeconds = alarm;
  invalidSeconds[2] = 0x80;
  invalidSeconds[3] = 0x51;
  invalidSeconds[4] = 0x01;
  assert(!isValidAlarmPacket(invalidSeconds.data(), invalidSeconds.size()));

  auto invalidFlash = alarm;
  invalidFlash[5] = 2;
  assert(!isValidAlarmPacket(invalidFlash.data(), invalidFlash.size()));

  auto invalidRamp = alarm;
  invalidRamp[6] = 0x59;
  invalidRamp[7] = 0x02;
  assert(!isValidAlarmPacket(invalidRamp.data(), invalidRamp.size()));

  auto invalidVolume = alarm;
  invalidVolume[8] = 101;
  assert(!isValidAlarmPacket(invalidVolume.data(), invalidVolume.size()));

  auto invalidHeader = alarm;
  invalidHeader[0] = 1;
  assert(!isValidAlarmPacket(invalidHeader.data(), invalidHeader.size()));
  assert(!isValidAlarmPacket(alarm.data(), alarm.size() - 1));
  assert(!isValidAlarmPacket(nullptr, alarm.size()));

  const std::array<uint8_t, 3> settings{0, 0xFF, 0xFF};
  assert(isValidSettingsPacket(settings.data(), settings.size()));
  assert(!isValidSettingsPacket(settings.data(), settings.size() - 1));

  auto invalidSettingsHeader = settings;
  invalidSettingsHeader[0] = 1;
  assert(!isValidSettingsPacket(
      invalidSettingsHeader.data(),
      invalidSettingsHeader.size()));
  assert(!isValidSettingsPacket(nullptr, settings.size()));

  const std::array<uint8_t, ALARM_PACKET_SIZE> alarmBytes{
      0, 0x01, 1, 0, 0, 0, 0, 0, 5};
  const ClockJob alarmJob = makeClockJob(
      ClockJobType::Alarm,
      alarmBytes.data());
  assert(alarmJob.type == ClockJobType::Alarm);
  for (size_t i = 0; i < alarmBytes.size(); ++i) {
    assert(alarmJob.packet.alarm[i] == alarmBytes[i]);
  }

  const std::array<uint8_t, SETTINGS_PACKET_SIZE> settingsBytes{0, 7, 1};
  const ClockJob settingsJob = makeClockJob(
      ClockJobType::Settings,
      settingsBytes.data());
  assert(settingsJob.type == ClockJobType::Settings);
  for (size_t i = 0; i < settingsBytes.size(); ++i) {
    assert(settingsJob.packet.settings[i] == settingsBytes[i]);
  }
}
