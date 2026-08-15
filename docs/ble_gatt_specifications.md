# BLE GATT specification

This document defines the firmware wire contract. Packet sizes are exact unless
an attribute explicitly says otherwise.

## Conventions

- Header value `0` is the only supported protocol version.
- Multi-byte integers are unsigned little-endian.
- `Write` means Write Request is accepted. `Write NR` means Write Without
  Response is accepted.
- The firmware is configured for one active BLE connection. A second central
  cannot connect until the current connection ends.
- Alarm Add, Modify, and Remove writes plus Settings writes are copied into one
  FIFO queue. Alarm Read selection is handled directly in the characteristic
  callback.
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
| Clock | `8984ff44-0000-4291-868b-2a44c36ed7e8` | Alarm, settings, message |

Only the Clock service UUID is included in advertising.

## Clock service

| Characteristic | UUID | Properties | Size | Client interval |
| --- | --- | --- | ---: | ---: |
| Alarm | `8984ff44-0001-4291-868b-2a44c36ed7e8` | Read, Write, Write NR | 13 write, 12 read | N/A |
| Settings | `8984ff44-0002-4291-868b-2a44c36ed7e8` | Write, Write NR | 3 | N/A |
| Message | `8984ff44-0003-4291-868b-2a44c36ed7e8` | Notify | 43 | N/A |

### Alarm write packet

Alarm writes are always 13 bytes:

- Header: 1 byte. Must be `0`.
- Command: 1 byte.
  - `0`: select an Alarm ID for the next characteristic read.
  - `1`: add an alarm. The Alarm ID byte is ignored.
  - `2`: modify the specified Alarm ID.
  - `3`: remove the specified Alarm ID. The packed Alarm fields are ignored.
- Alarm ID: 1 byte.
- Days active: 1-byte bitmap. Bits 0 through 6 are available; bit 7 must be
  clear. Accepted values are `0x00` through `0x7F`.
- Seconds of day: unsigned 24-bit value, 3 bytes. Accepted values are `0`
  through `86,399`.
- Tune ID: 1 byte. Accepted values are `0` through `31`.
- Alarm ramp duration: unsigned 16-bit value in seconds, 2 bytes. Accepted
  values are `0` through `600`.
- Volume: 1 byte. Accepted values are `0` through `100`.
- Auto-disable duration: unsigned 16-bit value in seconds, 2 bytes. Accepted
  values are `0` through `3,600`; `3,600` is the inclusive maximum.

The Add and Modify commands validate all packed Alarm fields. Read validates
the Alarm ID. Remove validates the Alarm ID and ignores the packed Alarm
fields, although those bytes must still be present to satisfy the fixed packet
size.

### Alarm read packet

After selecting an Alarm ID with command `0`, read the Alarm characteristic.
The response is 12 bytes: the `0` header, the selected 1-byte Alarm ID, then
the same 10 packed Alarm bytes documented above from Days active through
Auto-disable duration.

### Settings packet

- Header: 1 byte. Must be `0`.
- Setting ID: 1 byte.
- Value: 1 byte.

The accepted Setting ID and Value sets are not yet defined. Every possible
one-byte value is structurally valid.

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
through the Clock queue. This allows a queue rejection to be reported without
recursively enqueueing the error notification.

Current error codes are:

| Code | Meaning |
| ---: | --- |
| `0x03` | Clock queue rejected the write. |
| `0x04` | Client disconnect request failed. |
| `0x05` | Packet header or field value is invalid. |
| `0x06` | Packet size is invalid. |

Queue-creation, worker-creation, and other failures that occur before the
Message characteristic is available are written to the serial log instead.
