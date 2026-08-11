import ExpoModulesCore

public final class ShiftclockBleModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShiftclockBle")

    Events(
      "onDeviceDiscovered",
      "onConnectionStateChanged",
      "onMessageReceived"
    )

    AsyncFunction("scan") { () throws -> Void in
      throw Exception(
        name: "ShiftclockBleNotImplementedException",
        description: "ShiftclockBle.scan is not implemented",
        code: "ERR_NOT_IMPLEMENTED"
      )
    }

    AsyncFunction("stopScan") { () throws -> Void in
      throw Exception(
        name: "ShiftclockBleNotImplementedException",
        description: "ShiftclockBle.stopScan is not implemented",
        code: "ERR_NOT_IMPLEMENTED"
      )
    }

    AsyncFunction("connect") { (_: String) throws -> Void in
      throw Exception(
        name: "ShiftclockBleNotImplementedException",
        description: "ShiftclockBle.connect is not implemented",
        code: "ERR_NOT_IMPLEMENTED"
      )
    }

    AsyncFunction("disconnect") { () throws -> Void in
      throw Exception(
        name: "ShiftclockBleNotImplementedException",
        description: "ShiftclockBle.disconnect is not implemented",
        code: "ERR_NOT_IMPLEMENTED"
      )
    }

    AsyncFunction("writeAlarm") { (_: [String: Any]) throws -> Void in
      throw Exception(
        name: "ShiftclockBleNotImplementedException",
        description: "ShiftclockBle.writeAlarm is not implemented",
        code: "ERR_NOT_IMPLEMENTED"
      )
    }

    AsyncFunction("writeSettings") { (_: [String: Any]) throws -> Void in
      throw Exception(
        name: "ShiftclockBleNotImplementedException",
        description: "ShiftclockBle.writeSettings is not implemented",
        code: "ERR_NOT_IMPLEMENTED"
      )
    }
  }
}
