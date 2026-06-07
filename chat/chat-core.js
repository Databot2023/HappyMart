const hyperswarm = require('hyperswarm');
const crypto = require('hypercore-crypto');
const net = require('net');
const path = require('path');
const fs = require('fs');

class P2PChat {
  constructor(dataDir = '.p2p-chat') {
    this.dataDir = dataDir;
    this.swarm = null;
    this.keyPair = null;
    this.rooms = new Map();
    this.activeRoom = null;
    this.connections = new Map();
    this.messageCallbacks = [];
    this.peerCallbacks = [];
    this.isInitialized = false;
    this.pendingMessages = new Map();
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('[P2P] Already initialized');
      return;
    }

    console.log('[P2P] Initializing P2P chat engine...');

    this.keyPair = crypto.keyPair();
    console.log('[P2P] Generated keypair with public key:', this.keyPair.publicKey.toString('hex').slice(0, 16) + '...');

    this.swarm = hyperswarm({ multiplayer: true });
    
    this.swarm.on('connection', (conn, info) => {
      this._handleConnection(conn, info);
    });

    this.isInitialized = true;
    console.log('[P2P] Initialization complete');
    return this.keyPair.publicKey;
  }

  createRoom() {
    const roomKey = crypto.randomBytes(32);
    const roomKeyHex = roomKey.toString('hex');
    console.log('[P2P] Created new room with key:', roomKeyHex.slice(0, 8) + '...');
    return roomKey;
  }

  async joinRoom(roomKey) {
    if (!this.isInitialized) {
      throw new Error('Call initialize() before joining a room');
    }

    const roomKeyBuffer = typeof roomKey === 'string' ? Buffer.from(roomKey, 'hex') : roomKey;
    const roomKeyHex = roomKeyBuffer.toString('hex');

    console.log('[P2P] Joining room:', roomKeyHex.slice(0, 8) + '...');

    if (this.rooms.has(roomKeyHex)) {
      console.log('[P2P] Already in this room');
      return this.rooms.get(roomKeyHex);
    }

    const room = {
      key: roomKeyBuffer,
      keyHex: roomKeyHex,
      peers: new Set(),
      messageHistory: [],
      connectedPeers: new Set()
    };

    this.rooms.set(roomKeyHex, room);

    this.swarm.join(roomKeyBuffer, { announce: true, lookup: true });

    console.log('[P2P] Joined room. Waiting for peers...');

    setTimeout(() => {
      const history = this._loadHistory(roomKeyHex);
      if (history.length > 0) {
        console.log('[P2P] Loaded', history.length, 'messages from history');
        history.forEach(msg => {
          this.messageCallbacks.forEach(cb => cb({
            roomKey: roomKeyHex,
            sender: msg.sender,
            text: msg.text,
            timestamp: msg.timestamp,
            isLocal: false
          }));
        });
      }
    }, 2000);

    return room;
  }

  async sendMessage(roomKey, sender, text) {
    const roomKeyHex = typeof roomKey === 'string' ? roomKey : roomKey.toString('hex');
    const room = this.rooms.get(roomKeyHex);

    if (!room) {
      throw new Error('Not joined to this room');
    }

    const message = {
      type: 'message',
      sender: sender,
      text: text,
      timestamp: Date.now()
    };

    room.messageHistory.push({
      sender: sender,
      text: text,
      timestamp: message.timestamp
    });

    this._saveHistory(roomKeyHex, room.messageHistory);

    this._broadcastToRoom(roomKeyHex, message);

    console.log('[P2P] Message sent to room', roomKeyHex.slice(0, 8) + '...');

    this.messageCallbacks.forEach(cb => cb({
      roomKey: roomKeyHex,
      sender: sender,
      text: text,
      timestamp: message.timestamp,
      isLocal: true
    }));

    return true;
  }

  _broadcastToRoom(roomKeyHex, message) {
    const peers = this.connections.get(roomKeyHex);
    if (peers) {
      peers.forEach((conn, peerId) => {
        try {
          conn.write(JSON.stringify(message) + '\n');
        } catch (err) {
          console.error('[P2P] Error sending to peer:', err.message);
        }
      });
    }
  }

  _handleConnection(conn, info) {
    const peerKey = info.peer?.publicKey?.toString('hex').slice(0, 8) || 'unknown';
    console.log('[P2P] Peer connected:', peerKey + '...');

    this.peerCallbacks.forEach(cb => cb({ connected: true, peer: info.peer }));

    const roomKeyHex = this.activeRoom ? this.activeRoom.keyHex : null;
    
    if (roomKeyHex) {
      if (!this.connections.has(roomKeyHex)) {
        this.connections.set(roomKeyHex, new Map());
      }
      
      const roomPeers = this.connections.get(roomKeyHex);
      roomPeers.set(peerKey, conn);

      this._sendHistoryToPeer(conn, roomKeyHex);

      conn.on('data', (data) => {
        this._handlePeerMessage(roomKeyHex, peerKey, data);
      });

      conn.on('close', () => {
        console.log('[P2P] Peer disconnected:', peerKey);
        roomPeers.delete(peerKey);
        this.peerCallbacks.forEach(cb => cb({ connected: false }));
      });
    }

    conn.on('error', (err) => {
      console.error('[P2P] Connection error:', err.message);
    });
  }

  _handlePeerMessage(roomKeyHex, peerKey, data) {
    try {
      const messages = data.toString().split('\n').filter(m => m.trim());
      
      messages.forEach(msgStr => {
        const message = JSON.parse(msgStr);
        
        if (message.type === 'message') {
          const room = this.rooms.get(roomKeyHex);
          if (room && !room.messageHistory.some(m => m.timestamp === message.timestamp && m.sender === message.sender)) {
            room.messageHistory.push({
              sender: message.sender,
              text: message.text,
              timestamp: message.timestamp
            });
            this._saveHistory(roomKeyHex, room.messageHistory);

            this.messageCallbacks.forEach(cb => cb({
              roomKey: roomKeyHex,
              sender: message.sender,
              text: message.text,
              timestamp: message.timestamp,
              isLocal: false
            }));
          }
        } else if (message.type === 'history') {
          const room = this.rooms.get(roomKeyHex);
          if (room) {
            message.messages.forEach(msg => {
              if (!room.messageHistory.some(m => m.timestamp === msg.timestamp && m.sender === msg.sender)) {
                room.messageHistory.push(msg);
              }
            });
            this._saveHistory(roomKeyHex, room.messageHistory);
            
            room.messageHistory.forEach(msg => {
              this.messageCallbacks.forEach(cb => cb({
                roomKey: roomKeyHex,
                sender: msg.sender,
                text: msg.text,
                timestamp: msg.timestamp,
                isLocal: false
              }));
            });
          }
        }
      });
    } catch (err) {
      console.error('[P2P] Error parsing peer message:', err.message);
    }
  }

  _sendHistoryToPeer(conn, roomKeyHex) {
    const room = this.rooms.get(roomKeyHex);
    if (room && room.messageHistory.length > 0) {
      const historyMsg = {
        type: 'history',
        messages: room.messageHistory
      };
      conn.write(JSON.stringify(historyMsg) + '\n');
    }
  }

  _loadHistory(roomKeyHex) {
    const historyFile = this._getHistoryPath(roomKeyHex);
    try {
      if (fs.existsSync(historyFile)) {
        const data = fs.readFileSync(historyFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('[P2P] Error loading history:', err.message);
    }
    return [];
  }

  _saveHistory(roomKeyHex, messages) {
    const historyFile = this._getHistoryPath(roomKeyHex);
    try {
      const dir = path.dirname(historyFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(historyFile, JSON.stringify(messages));
    } catch (err) {
      console.error('[P2P] Error saving history:', err.message);
    }
  }

  _getHistoryPath(roomKeyHex) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
    return path.join(homeDir, this.dataDir, 'history', roomKeyHex + '.json');
  }

  onNewMessage(callback) {
    this.messageCallbacks.push(callback);
  }

  onPeerUpdate(callback) {
    this.peerCallbacks.push(callback);
  }

  getRooms() {
    return Array.from(this.rooms.keys());
  }

  setActiveRoom(roomKey) {
    const roomKeyHex = typeof roomKey === 'string' ? roomKey : roomKey.toString('hex');
    this.activeRoom = this.rooms.get(roomKeyHex);
    
    if (this.activeRoom && !this.connections.has(roomKeyHex)) {
      this.connections.set(roomKeyHex, new Map());
    }
  }

  getActiveRoom() {
    return this.activeRoom;
  }

  getCurrentRoomKeyHex() {
    return this.activeRoom ? this.activeRoom.keyHex : null;
  }

  async close() {
    console.log('[P2P] Closing P2P chat...');
    if (this.swarm) {
      this.swarm.destroy();
    }
    this.connections.clear();
    console.log('[P2P] Closed');
  }
}

module.exports = P2PChat;