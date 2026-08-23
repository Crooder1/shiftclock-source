# BLE GATT specification

This document defines the firmware wire contract. Packet sizes are exact unless
an attribute explicitly says otherwise.

## Conventions

- Header value `0` is the only supported protocol version.
- Multi-byte integers are unsigned little-endian. Settings ID and value bytes
  are signed 8-bit integers encoded in two's-complement form.
- `Write` means Write Request is accepted. `Write NR` means Write Without
  Response is accepted.
- The firmware is configured for one active BLE connection. A second central
  cannot connect until the current connection ends.
- Alarm Add, Modify, Remove, Commit, and Reload writes plus Settings writes are
  copied into the Clock FIFO. Tune Play writes use a separate audio FIFO
  consumed by the Alarm worker, which is the sole I2S writer. Tune Cancel
  uses a reserved Stop slot so cancellation cannot be rejected by four pending
  Play commands. Alarm and Tune Read selection are handled directly in their
  characteristic callbacks.
- Packet size and header validation plus enqueueing happen in the
  characteristic write callback. Queued Alarm commands and field ranges are
  validated by the worker before the Alarm collection is changed.
- The largest attribute is the 43-byte Message packet. A notification needs an
  ATT MTU of at least 46 bytes (`43 + 3` bytes of ATT overhead). The firmware
  configures 46 as its preferred local MTU, but the client must still initiate
  and complete MTU exchange.
- No time-based client rate limits are currently defined or enforced.

## Service overview

| Service | UUID | Characteristics |
| --- | --- | --- |
| Clock | `8984ff44-0000-4291-868b-2a44c36ed7e8` | Alarm, Tune, settings, message |

Only the Clock service UUID is included in advertising.

## Clock service

| Characteristic | UUID | Properties | Size | Client interval |
| --- | --- | --- | ---: | ---: |
| Alarm | `8984ff44-0001-4291-868b-2a44c36ed7e8` | Read, Write, Write NR | 13 write, 12 read | N/A |
| Settings | `8984ff44-0002-4291-868b-2a44c36ed7e8` | Read, Write, Write NR | 3 write, 8 read | N/A |
| Message | `8984ff44-0003-4291-868b-2a44c36ed7e8` | Notify | 43 | N/A |
| Tune | `8984ff44-0004-4291-868b-2a44c36ed7e8` | Read, Write, Write NR | 3 write, 26 read | N/A |

### Alarm write packet

Alarm writes are always 13 bytes:

- Header: 1 byte. Must be `0`.
- Command: 1 byte.
  - `0`: select an Alarm ID for the next characteristic read. Alarm ID `0xFF`
    selects the Alarm count response.
  - `1`: add an alarm. The Alarm ID byte is ignored.
  - `2`: modify the specified Alarm ID.
  - `3`: remove the specified Alarm ID. The packed Alarm fields are ignored.
  - `4`: commit the current in-memory Alarm collection to persistent storage.
    The Alarm ID and packed Alarm fields are ignored.
  - `5`: reload the Alarm collection from persistent storage. The Alarm ID and
    packed Alarm fields are ignored.
- Alarm ID: 1 byte.
- Days active: 1-byte bitmap. Bit 0 is Sunday, bit 1 is Monday, bit 2 is
  Tuesday, bit 3 is Wednesday, bit 4 is Thursday, bit 5 is Friday, and bit 6
  is Saturday. Bit 7 must be clear. Accepted values are `0x00` through `0x7F`.
- Seconds of day: unsigned 24-bit value, 3 bytes. Accepted values are `0`
  through `86,399`.
- Tune ID: 1 byte. Accepted values are `0` through `31`.
- Alarm ramp duration: unsigned 16-bit value in seconds, 2 bytes. Accepted
  values are `0` through `600`.
- Volume: 1 byte. Accepted values are `0` through `100`.
- Auto-disable duration: unsigned 16-bit value in seconds, 2 bytes. Accepted
  values are `0` through `3,600`; `3,600` is the inclusive maximum.

The Add and Modify commands validate all packed Alarm fields. Read validates
the Alarm ID. Remove validates the Alarm ID. Remove, Commit, and Reload ignore
the packed Alarm fields, although those bytes must still be present to satisfy
the fixed packet size. Commit and Reload emit `INFO_OPERATION_SUCCEEDED` only
after the persistence operation succeeds. Committing an empty collection
removes the stored Alarm value; reloading a missing or empty stored value
clears the in-memory collection.

### Alarm read packet

After selecting an Alarm ID with command `0`, read the Alarm characteristic.
The response is 12 bytes: the `0` header, the selected 1-byte Alarm ID, then
the same 10 packed Alarm bytes documented above from Days active through
Auto-disable duration.

Selecting Alarm ID `0xFF` returns the same 12-byte response shape with the
current Alarm count in the ID byte and all 10 packed Alarm bytes set to zero.
Reading before any selection also returns this count response. Alarm IDs other
than `0xFF` must be below the current Alarm count.

### Tune write packet

Tune writes are exactly 3 bytes:

- Header: 1 byte. Must be `0`.
- Command: 1 byte.
  - `0`: select a Tune ID for the next characteristic read.
  - `1`: play or cancel Tune audio.
- Tune ID: 1 byte.
  - For Read, a value below the current Tune count selects that Tune and
    `0xFF` selects the Tune count response.
  - For Play, a value below the current Tune count plays one loop at 100% of
    the Tune volume, scaled by the clock's Volume setting. `0xFF` cancels the
    audio currently being written.

Other commands and Tune IDs are rejected. Read selection is handled directly
and emits `INFO_OPERATION_SUCCEEDED`. Play uses the four-entry audio FIFO.
Before the first I2S chunk and between later chunks, the Alarm worker stops the
current audio whenever another audio command is queued. Cancel queues Stop in a
fifth reserved slot; consecutive pending Stops coalesce, while a Stop arriving
after a later Play remains queued after that Play. Earlier Play commands stay
FIFO-ordered, observe the later command before writing another chunk, and each
emit `INFO_OPERATION_SUCCEEDED` in request order. Cancel emits no separate
operation-success notification. A later Play queued after Stop may start
normally. Either Play or Cancel also interrupts an active Alarm because the
Alarm worker owns all I2S playback.

### Tune read packet

After selecting a Tune ID, read the Tune characteristic. The response is
exactly 26 bytes:

| Offset | Size | Field |
| ---: | ---: | --- |
| 0 | 1 | Header `0` |
| 1 | 1 | Selected Tune ID |
| 2 | 4 | Audio data length, unsigned little-endian |
| 6 | 20 | Null-padded Tune name |

At most 19 Tune-name bytes are returned; the name field always contains a null
terminator. Audio data itself is not returned.

Selecting Tune ID `0xFF` returns the current Tune count in the ID byte and sets
the data-length and name fields to zero. Reading before any selection also
returns this count response. The 26-byte value requires an ATT MTU of at least
29 bytes, which is below the firmware's preferred MTU of 46.

### Settings write packet

- Header: 1 byte. Must be `0`.
- Setting ID: signed 1-byte integer encoded using two's complement.
- Value: signed 1-byte integer encoded using two's complement.

Settings use these IDs and inclusive value ranges:

| ID | Setting | Range |
| ---: | --- | ---: |
| `0` | Timezone offset in hours | `-12` through `11` |
| `1` | Brightness | `0` through `15` |
| `2` | Seconds | `0` through `1` |
| `3` | Moving decimal point | `0` through `2` |
| `4` | Volume | `0` through `100` |
| `5` | 12-hour clock | `0` through `1` |
| `6` | AM/PM indicator | `0` through `1` |

Setting ID `-1` (`0xFF`) selects a persistence command:

- Value `-1` (`0xFF`) commits the current Settings values.
- Value `-2` (`0xFE`) reloads Settings from persistent storage.

### Settings read packet

Settings reads return exactly 8 bytes: header `0`, followed by the seven
signed Settings values in ID order from `0` through `6`. Every value byte uses
two's-complement encoding; for example, timezone `-12` is encoded as `0xF4`.

### Message packet

- Header: 1 byte. Always `0`.
- Message type: 1 byte.
  - `0`: info.
  - `1`: error.
  - `2+`: reserved.
- Message code: 1 byte.
- Description: 40 null-padded bytes. At most 39 bytes are usable text and the
  final byte is always a null terminator.

The Message characteristic is the direct notification path and is not routed
through the Clock or audio queues. This allows a queue rejection to be reported
without recursively enqueueing the error notification.

Current error codes are:

| Code | Meaning |
| ---: | --- |
| `0x03` | Clock queue rejected the write. |
| `0x04` | Client disconnect request failed. |
| `0x05` | Packet header or field value is invalid. |
| `0x06` | Packet size is invalid. |
| `0x07` | A requested operation failed or Tune audio is unavailable. |

Queue-creation, worker-creation, and other failures that occur before the
Message characteristic is available are written to the serial log instead.
