# P2P Encrypted Chat

A fully peer-to-peer encrypted chat application using the Holepunch technology stack. Uses Hyperswarm for DHT-based peer discovery without any central servers.

## Features

- **Fully Decentralized** - No central servers, peers connect directly via DHT
- **End-to-End Encryption** - Messages encrypted using hypercore-crypto
- **Room-Based Architecture** - Create/join rooms with 64-character hex keys (32 bytes)
- **Message Persistence** - All messages stored locally in JSON files
- **Cross-Network** - Works across machines on the same network or internet via Hyperswarm DHT

## Installation

```bash
npm install
```

## Usage

### Start the chat

```bash
npm start
```

Or directly:

```bash
node cli-chat.js
```

### First Run

1. Enter your username when prompted
2. Use the commands below to create or join rooms

### Commands

| Command | Description |
|---------|-------------|
| `/create` | Create a new chat room |
| `/join <key>` | Join an existing room by key |
| `/rooms` | List all joined rooms |
| `/current` | Show current room info |
| `/quit` | Exit the chat |

### Example Session

```
Enter your username: Alice
[P2P] Initializing P2P chat engine...
[P2P] Generated keypair with public key: a1b2c3d4e5f6...
[P2P] Initialization complete

--- Commands ---
/create          - Create a new chat room
/join <key>      - Join an existing room
/rooms           - List joined rooms
/current         - Show current room
/quit            - Exit the chat
-----------------

[no-room] Alice: /create

[Room Created]
Share this key with others to join:
a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

[Joined Room] Key: a1b2c3d4e5f6...

[a1b2c3d4] Alice: Hello everyone!
```

### Joining a Room

To join a room created by someone else:

```
[no-room] Alice: /join <paste-room-key-here>
```

## How It Works

### Architecture

1. **Hyperswarm** - Handles peer discovery via DHT (Distributed Hash Table)
2. **hypercore-crypto** - Handles key generation and encryption
3. **JSON Files** - Message persistence in `~/.p2p-chat/history/`

### Data Flow

1. User creates/joins a room with a 32-byte topic key (64 hex chars)
2. Hyperswarm announces the topic and looks for peers on the DHT
3. When peers connect, messages are exchanged directly
4. Messages are broadcast to all connected peers in the room
5. Messages are stored locally in JSON format for history

### Storage

All data is stored in `~/.p2p-chat/`:
- Message history stored as JSON files per room
- Each room has its own history file

## Technical Notes

This implementation uses a simplified architecture that works without native modules:
- Uses pure JavaScript networking via Hyperswarm
- Message storage via JSON files instead of Hypercore
- Works without leveldown compilation issues

## License

MIT