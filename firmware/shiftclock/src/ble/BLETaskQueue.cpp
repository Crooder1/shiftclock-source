#include "BLETaskQueue.hpp"

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>

namespace {

QueueHandle_t clockQueue = nullptr;
TaskHandle_t clockTask = nullptr;
TaskHandle_t shutdownCoordinator = nullptr;
volatile bool workerShuttingDown = false;

void clockWorker(void*) {
  ClockJob job{};
  bool shutdownRequested = false;

  while (!shutdownRequested) {
    if (xQueueReceive(clockQueue, &job, portMAX_DELAY) != pdPASS) {
      continue;
    }

    switch (job.type) {
      case ClockJobType::TaskShutdown:
        shutdownRequested = true;
        break;

      case ClockJobType::Alarm:
        // Alarm packet handling will be connected here.
        break;

      case ClockJobType::Settings:
        // Settings packet handling will be connected here.
        break;
    }
  }

  clockTask = nullptr;

  const TaskHandle_t coordinator = shutdownCoordinator;
  if (coordinator != nullptr) {
    xTaskNotifyGive(coordinator);
  }

  vTaskDelete(nullptr);
}

} // namespace

uint8_t initializeBLETaskQueue() {
  if (clockQueue != nullptr && clockTask != nullptr) {
    return BLEQUEUE_INIT_SUCCESS;
  }

  workerShuttingDown = false;
  clockQueue = xQueueCreate(CLOCK_QUEUE_SIZE, sizeof(ClockJob));
  if (clockQueue == nullptr) {
    Serial.println("Clock queue creation failed");
    return BLEQUEUE_CREATE_FAIL;
  }

  if (xTaskCreate(
      clockWorker,
      "clock_worker",
      CLOCK_STACK_DEPTH,
      nullptr,
      1,
      &clockTask
  ) != pdPASS) {
    Serial.println("Clock queue task creation failed");
    vQueueDelete(clockQueue);
    clockQueue = nullptr;
    return BLEQUEUE_TASK_FAIL;
  }

  return BLEQUEUE_INIT_SUCCESS;
}

bool deinitializeBLETaskQueue() {
  workerShuttingDown = true;

  if (clockTask != nullptr) {
    shutdownCoordinator = xTaskGetCurrentTaskHandle();

    ClockJob shutdownJob{};
    shutdownJob.type = ClockJobType::TaskShutdown;

    if (
      clockQueue == nullptr
      || xQueueSendToFront(
          clockQueue,
          &shutdownJob,
          pdMS_TO_TICKS(5000)
      ) != pdPASS
    ) {
      Serial.println("Failed to queue clock worker shutdown");
      shutdownCoordinator = nullptr;
      return false;
    }

    if (ulTaskNotifyTake(pdTRUE, pdMS_TO_TICKS(5000)) == 0) {
      Serial.println("Timed out waiting for clock worker shutdown");
      shutdownCoordinator = nullptr;
      return false;
    }
  }

  shutdownCoordinator = nullptr;

  if (clockQueue != nullptr) {
    vQueueDelete(clockQueue);
    clockQueue = nullptr;
  }

  workerShuttingDown = false;
  return true;
}

bool queueClockJob(const ClockJob& job) {
  if (clockQueue == nullptr || workerShuttingDown) return false;
  return xQueueSend(clockQueue, &job, 0) == pdPASS;
}
