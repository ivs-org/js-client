# Protocol (ControlWS + MediaWS)

> TODO: This doc should be updated alongside server changes.

## ControlWS (JSON)
### Connection
- `connect_request` / `connect_response`
- auth token flow: TODO

### Presence
- `change_contact_state`: { id, state }
  - state enum: TODO (1=offline,2=online per your logs)

### Members/Confs
- `change_member_state`: TODO
- groups/confs init payloads: TODO

### Messaging
- `delivery_messages`:
  - full message delivery
  - status update delivery (guid + status only)

Message enums (from server):
- MessageType: TextMessage, Call, Join, Leave, ...
- MessageStatus: Created, Sended, Delivered, Readed, Modified, Deleted
- CallResult: Answered, Missed, Rejected, Busy, Offline

> TODO: include concrete JSON examples for:
- text message
- status update
- reaction
- typing
- service message

### Unread counters
- increment on new message per member/conf
- reset on open chat

## MediaWS (WSM + RTP/RTCP)
### Media connect
- `connect_request: { channel_type: 1, access_token }`
- `connect_response` triggers:
  - RTP init frame
  - for video: force keyframe request

### Binary frames
- WsBinaryMsgType.Media frames contain RTP payload
- RTP header parsing uses `rtpHeaderLen`
- Crypto:
  - AES-GCM decrypt per packet
  - IV: makeIvGcm(ssrc, ts, seq)
  - AAD: first 12 bytes RTP header

### Force keyframe
- RTCP APP packet (serializeRTCP_APP), appName: TODO

### Disconnect
- Client sends `{ disconnect: {} }` before closing ws

## Error handling
- invalid payload -> drop packet
- decrypt fail -> drop packet and warn with seq/ts/ssrc
