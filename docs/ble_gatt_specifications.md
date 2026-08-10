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
- Valid Alarm and Settings writes are copied into one FIFO queue. The current
  worker deliberately leaves their application behavior unwired.
- Packet validation and enqueueing happen in the characteristic write callback.
  Invalid or rejected writes are not placed in the queue.
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
| Alarm | `8984ff44-0001-4291-868b-2a44c36ed7e8` | Write, Write NR | 9 | N/A |
| Settings | `8984ff44-0002-4291-868b-2a44c36ed7e8` | Write, Write NR | 3 | N/A |
| Message | `8984ff44-0003-4291-868b-2a44c36ed7e8` | Notify | 43 | N/A |

### Alarm packet

- Header: 1 byte. Must be `0`.
- Days active: 1-byte bitmap. Bits 0 through 6 are available; bit 7 must be
  clear. Accepted values are `0x00` through `0x7F`.
- Seconds of day: unsigned 24-bit value, 3 bytes. Accepted values are `0`
  through `86,399`.
- Flash until off: 1 byte. Accepted values are `0` and `1`.
- Alarm ramp duration: unsigned 16-bit value in seconds, 2 bytes. Accepted
  values are `0` through `600`.
- Volume: 1 byte. Accepted values are `0` through `100`.

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
