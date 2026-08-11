package expo.modules.shiftclockble

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ShiftclockBleModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ShiftclockBle")

    Events(
      "onDeviceDiscovered",
      "onConnectionStateChanged",
      "onMessageReceived"
    )

    AsyncFunction("scan") {
      throw CodedException(
        "ERR_NOT_IMPLEMENTED",
        "ShiftclockBle.scan is not implemented",
        null
      )
    }

    AsyncFunction("stopScan") {
      throw CodedException(
        "ERR_NOT_IMPLEMENTED",
        "ShiftclockBle.stopScan is not implemented",
        null
      )
    }

    AsyncFunction("connect") { deviceId: String ->
      throw CodedException(
        "ERR_NOT_IMPLEMENTED",
        "ShiftclockBle.connect is not implemented",
        null
      )

      Unit
    }

    AsyncFunction("disconnect") {
      throw CodedException(
        "ERR_NOT_IMPLEMENTED",
        "ShiftclockBle.disconnect is not implemented",
        null
      )
    }

    AsyncFunction("writeAlarm") { payload: Map<String, Any?> ->
      throw CodedException(
        "ERR_NOT_IMPLEMENTED",
        "ShiftclockBle.writeAlarm is not implemented",
        null
      )

      Unit
    }

    AsyncFunction("writeSettings") { payload: Map<String, Any?> ->
      throw CodedException(
        "ERR_NOT_IMPLEMENTED",
        "ShiftclockBle.writeSettings is not implemented",
        null
      )

      Unit
    }
  }
}
