#!/usr/bin/env node

const readline = require('readline');
const P2PChat = require('./chat-core');
const crypto = require('crypto');

const DATA_DIR = '.p2p-chat';

class CLIChat {
  constructor() {
    this.p2p = new P2PChat(DATA_DIR);
    this.username = null;
    this.rl = null;
    this.currentRoom = null;
    this.currentRoomKey = null;
    this.running = true;
  }

  async start() {
    console.log('========================================');
    console.log('   P2P Encrypted Chat (Holepunch Stack)');
    console.log('========================================\n');

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await this._setupUsername();
    await this._initializeP2P();

    this._setupMessageHandler();

    console.log('\n--- Commands ---');
    console.log('/create          - Create a new chat room');
    console.log('/join <key>      - Join an existing room');
    console.log('/rooms           - List joined rooms');
    console.log('/current         - Show current room');
    console.log('/quit            - Exit the chat');
    console.log('-----------------\n');

    this._prompt();

    this.rl.on('line', (input) => this._handleInput(input));
  }

  async _setupUsername() {
    return new Promise((resolve) => {
      this.rl.question('Enter your username: ', (answer) => {
        this.username = answer.trim() || 'Anonymous';
        console.log(`Username set to: ${this.username}\n`);
        resolve();
      });
    });
  }

  async _initializeP2P() {
    try {
      await this.p2p.initialize();
    } catch (err) {
      console.error('[Error] Failed to initialize P2P:', err.message);
      process.exit(1);
    }
  }

  _setupMessageHandler() {
    this.p2p.onNewMessage((msg) => {
      if (msg.roomKey === this.currentRoomKey) {
        const time = new Date(msg.timestamp).toLocaleTimeString();
        const prefix = msg.isLocal ? '(You)' : msg.sender;

        if (!msg.isLocal) {
          console.log(`\n[${time}] ${prefix}: ${msg.text}\n`);
          this._prompt(true);
        } else {
          console.log(`\n[${time}] ${prefix}: ${msg.text}\n`);
          this._prompt(true);
        }
      }
    });

    this.p2p.onPeerUpdate((info) => {
      if (info.connected) {
        console.log('\n[System] Peer joined the room\n');
        this._prompt(true);
      }
    });
  }

  async _handleInput(input) {
    const trimmed = input.trim();

    if (!trimmed) {
      this._prompt();
      return;
    }

    if (trimmed.startsWith('/')) {
      await this._handleCommand(trimmed);
    } else {
      await this._handleMessage(trimmed);
    }

    this._prompt();
  }

  async _handleCommand(cmd) {
    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case '/create':
        await this._createRoom();
        break;

      case '/join':
        if (args.length === 0) {
          console.log('[Error] Usage: /join <room-key>');
        } else {
          await this._joinRoom(args[0]);
        }
        break;

      case '/rooms':
        this._listRooms();
        break;

      case '/current':
        this._showCurrentRoom();
        break;

      case '/quit':
        await this._quit();
        break;

      case '/help':
        console.log('\n--- Commands ---');
        console.log('/create          - Create a new chat room');
        console.log('/join <key>      - Join an existing room');
        console.log('/rooms           - List joined rooms');
        console.log('/current         - Show current room');
        console.log('/quit            - Exit the chat');
        console.log('-----------------\n');
        break;

      default:
        console.log('[Error] Unknown command:', command);
    }
  }

  async _createRoom() {
    try {
      const roomKey = this.p2p.createRoom();
      const roomKeyHex = roomKey.toString('hex');

      console.log('\n[Room Created]');
        console.log('Share this key with others to join:');
        console.log(roomKeyHex);
        console.log('');

      await this._joinRoom(roomKeyHex);
    } catch (err) {
      console.log('[Error] Failed to create room:', err.message);
    }
  }

  async _joinRoom(key) {
    try {
      let roomKey = key;

      if (key.length === 64) {
      } else if (key.length === 32) {
        roomKey = Buffer.from(key, 'hex').toString('hex');
      } else {
        console.log('[Error] Invalid room key format');
        return;
      }

      this.currentRoom = await this.p2p.joinRoom(roomKey);
      this.currentRoomKey = this.p2p.getCurrentRoomKeyHex();
      this.p2p.setActiveRoom(roomKey);

      console.log('\n[Joined Room] Key:', this.currentRoomKey.slice(0, 16) + '...\n');

      const history = await this._loadHistory();
      if (history.length > 0) {
        console.log('--- Message History ---\n');
        for (const msg of history) {
          const time = new Date(msg.timestamp).toLocaleTimeString();
          console.log(`[${time}] ${msg.sender}: ${msg.text}`);
        }
        console.log('--- End History ---\n');
      }
    } catch (err) {
      console.log('[Error] Failed to join room:', err.message);
    }
  }

  async _loadHistory() {
    return [];
  }

  _listRooms() {
    const rooms = this.p2p.getRooms();

    if (rooms.length === 0) {
      console.log('[Rooms] No rooms joined yet');
      return;
    }

    console.log('\n[Joined Rooms]');
    rooms.forEach((key, index) => {
      const current = key === this.currentRoomKey ? ' (current)' : '';
      console.log(`${index + 1}. ${key.slice(0, 16)}...${current}`);
    });
    console.log('');
  }

  _showCurrentRoom() {
    if (!this.currentRoomKey) {
      console.log('[Current] Not in any room');
      return;
    }

    console.log('\n[Current Room]');
    console.log('Key:', this.currentRoomKey);
    console.log('');
  }

  async _handleMessage(text) {
    if (!this.currentRoomKey) {
      console.log('[Error] Not in any room. Use /create or /join <key> first.');
      return;
    }

    try {
      await this.p2p.sendMessage(this.currentRoomKey, this.username, text);
    } catch (err) {
      console.log('[Error] Failed to send message:', err.message);
    }
  }

  _prompt(preserveLine = false) {
    if (this.running) {
      if (preserveLine) {
        readline.moveCursor(process.stdout, 0, 0);
      }
      const roomPrefix = this.currentRoomKey
        ? `[${this.currentRoomKey.slice(0, 8)}...] `
        : '[no-room] ';
      this.rl.setPrompt(`${roomPrefix}${this.username}: `);
      this.rl.prompt();
    }
  }

  async _quit() {
    console.log('\n[Goodbye] Shutting down...');
    this.running = false;
    await this.p2p.close();
    this.rl.close();
    process.exit(0);
  }
}

if (require.main === module) {
  const chat = new CLIChat();
  chat.start().catch(err => {
    console.error('[Fatal Error]', err);
    process.exit(1);
  });
}

module.exports = CLIChat;