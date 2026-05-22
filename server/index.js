const express = require('express');
const app = express();
const http = require('http');
const cors = require('cors');
const WebSocket = require('ws');
const mongoose = require('mongoose');
const Y = require('yjs');

// Modelleri İçe Aktar
const Message = require('./models/Message');
const RoomState = require('./models/RoomState');

// API Yollarını İçe Aktar
const authRoutes = require('./routes/auth');
const friendRoutes = require('./routes/friends');
const roomRoutes = require('./routes/rooms');

app.use(express.json());
app.use(cors());

const onlineUsers = new Map(); // username -> websocket objesi
app.set('onlineUsers', onlineUsers);

app.use('/api', authRoutes);
app.use('/api', friendRoutes);
app.use('/api', roomRoutes);

const MONGO_URI = "mongodb+srv://muhammetmustafakayaa_db:Mess_1143@cluster0.5jvenbw.mongodb.net/KodPaylasimDB?appName=Cluster0";

mongoose.connect(MONGO_URI)
    .then(() => console.log('🟢 MongoDB Veri Tabanına Tıkır Tıkır Bağlandım!'))
    .catch((err) => console.log('🔴 VERİ TABANI BAĞLANTI HATASI:', err));

const rooms = new Map();

function broadcastUserList(room) {
    // 🔴 YENİ: Set kullanarak aynı isimleri teke düşürüyoruz!
    const uniqueUsers = [...new Set(room.activeUsers.values())];

    for (const client of room.activeUsers.keys()) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'users', data: uniqueUsers }));
        }
    }
}

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.on('message', async (message, isBinary) => {
        if (isBinary) {
            for (const [roomName, room] of rooms.entries()) {
                if (room.activeUsers.has(ws)) {
                    // 1. Gelen harfi hafızadaki Yjs belgesine işle
                    Y.applyUpdate(room.ydoc, new Uint8Array(message));

                    // 2. HİÇ BEKLEMEDEN anında diğer kullanıcılara fırlat! (Senkronizasyonun kalbi)
                    room.activeUsers.forEach((uname, client) => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(message);
                        }
                    });

                    // 3. Veritabanını her harfte boğmamak için "Debounce" yapıyoruz
                    // Eğer önceden ayarlanmış bir kayıt sayacı varsa onu iptal et
                    if (room.saveTimeout) clearTimeout(room.saveTimeout);

                    // Yazma işlemi bittikten 2 saniye sonra veritabanına tek seferde kaydet
                    room.saveTimeout = setTimeout(async () => {
                        try {
                            const stateBuffer = Buffer.from(Y.encodeStateAsUpdate(room.ydoc));
                            await RoomState.findOneAndUpdate(
                                { roomId: roomName },
                                { $set: { codeState: stateBuffer } },
                                { upsert: true }
                            );
                        } catch (err) {
                            console.log("DB Kayıt hatası:", err);
                        }
                    }, 2000);

                    break;
                }
            }
            return;
        }

        try {
            const parsed = JSON.parse(message.toString());

            if (parsed.type === 'init') {
                onlineUsers.set(parsed.username, ws);
                return;
            }

            // Kullanıcının odasını bulmak için yardımcı döngü
            let userRoomName = null;
            let roomObj = null;
            for (const [rName, rObj] of rooms.entries()) {
                if (rObj.activeUsers.has(ws)) { userRoomName = rName; roomObj = rObj; break; }
            }

            // 🔴 YENİ: WebRTC Canlı Ses Sinyal Dağıtıcısı (Hedef odaklı)
            if (parsed.type === 'signal' && userRoomName) {
                rooms.get(userRoomName).activeUsers.forEach((uname, client) => {
                    if (uname === parsed.target && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'signal', sender: parsed.sender, data: parsed.data }));
                    }
                });
                return;
            }

            // 🔴 YENİ: Sesli Sohbete Katılma / Ayrılma Bildirimi
            if (parsed.type === 'audio_action' && userRoomName) {
                rooms.get(userRoomName).activeUsers.forEach((uname, client) => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'audio_action', sender: parsed.sender, action: parsed.action }));
                    }
                });
                return;
            }

            if (parsed.type === 'join') {
                const roomName = parsed.room;
                const username = parsed.username;

                if (!rooms.has(roomName)) {
                    const dbRoom = await RoomState.findOne({ roomId: roomName });
                    const ydoc = new Y.Doc();
                    if (dbRoom && dbRoom.codeState) Y.applyUpdate(ydoc, new Uint8Array(dbRoom.codeState));
                    rooms.set(roomName, { ydoc, activeUsers: new Map() });
                }

                const room = rooms.get(roomName);
                room.activeUsers.set(ws, username);

                const currentCodeUpdate = Y.encodeStateAsUpdate(room.ydoc);
                ws.send(Buffer.from(currentCodeUpdate));
                broadcastUserList(room);

                const oldMessages = await Message.find({ room: roomName }).sort({ timestamp: 1 }).limit(50);
                oldMessages.forEach(msg => {
                    ws.send(JSON.stringify({ type: 'chat', data: { sender: msg.sender, text: msg.text } }));
                });
                return;
            }

            if (parsed.type === 'chat') {
                if (userRoomName && roomObj) {
                    const newMsg = new Message({ room: userRoomName, sender: parsed.data.sender, text: parsed.data.text });
                    await newMsg.save();
                    roomObj.activeUsers.forEach((uname, client) => {
                        if (client.readyState === WebSocket.OPEN) client.send(message.toString());
                    });
                }
                return;
            }
        } catch (e) { }
    });

    ws.on('close', () => {
        for (const [uname, socket] of onlineUsers.entries()) {
            if (socket === ws) onlineUsers.delete(uname);
        }
        for (const [roomName, room] of rooms.entries()) {
            if (room.activeUsers.has(ws)) {
                const leftUser = room.activeUsers.get(ws);
                room.activeUsers.delete(ws);
                broadcastUserList(room);
                // Odadan çıkan adamın ses tünelini diğerlerinden de temizletelim
                room.activeUsers.forEach((uname, client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'audio_action', sender: leftUser, action: 'leave' }));
                    }
                });
                if (room.activeUsers.size === 0) rooms.delete(roomName);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Sunucu ${PORT} portunda canlıya hazır!`));