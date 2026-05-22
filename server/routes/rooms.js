const express = require('express');
const router = express.Router();
const Y = require('yjs');
const User = require('../models/User');
const RoomState = require('../models/RoomState');

// Yeni Oda Oluşturma
router.post('/create-room', async (req, res) => {
    try {
        const { username, roomName, roomId } = req.body;
        await RoomState.findOneAndUpdate({ roomId }, { $set: { roomName } }, { upsert: true });
        await User.updateOne({ username }, { $addToSet: { joinedRooms: roomId } });
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ message: "Oluşturulamadı" }); }
});

// Var Olan Odaya Katılma
router.post('/join-room', async (req, res) => {
    try {
        const { username, roomId } = req.body;
        await RoomState.findOneAndUpdate({ roomId }, { $setOnInsert: { roomName: 'Davetle Gelinilen Oda' } }, { upsert: true });
        await User.updateOne({ username }, { $addToSet: { joinedRooms: roomId } });
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ message: "Katılınamadı" }); }
});

// Geçmiş Odalarımı Çekme
router.get('/my-rooms/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.json([]);
        const rooms = await RoomState.find({ roomId: { $in: user.joinedRooms } }, 'roomId roomName');
        res.json(rooms);
    } catch (err) { res.status(500).json([]); }
});

// Odayı Geçmişten Silme (Kişisel)
router.post('/remove-room', async (req, res) => {
    try {
        const { username, roomId } = req.body;
        await User.updateOne({ username }, { $pull: { joinedRooms: roomId } });
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ message: "Silinemedi" }); }
});

// Oda Kodunu ve İsmini Yükleme
router.get('/room/:roomId', async (req, res) => {
    try {
        const room = await RoomState.findOne({ roomId: req.params.roomId });
        const roomName = room ? room.roomName : 'İsimsiz Oda';
        if (room && room.codeState) {
            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, new Uint8Array(room.codeState));
            return res.json({ code: ydoc.getText('monaco').toString(), roomName });
        }
        res.json({ code: "// Kod yazmaya başla abi...", roomName });
    } catch (e) { res.json({ code: "// Yükleme hatası...", roomName: 'Hata' }); }
});

// Kod Değişikliğini Kaydetme
router.post('/save-code', async (req, res) => {
    try {
        const { roomId, code } = req.body;
        const ydoc = new Y.Doc();
        ydoc.getText('monaco').insert(0, code);
        const stateBuffer = Buffer.from(Y.encodeStateAsUpdate(ydoc));
        await RoomState.findOneAndUpdate({ roomId }, { $set: { codeState: stateBuffer } }, { upsert: true });
        res.sendStatus(200);
    } catch (e) { res.sendStatus(500); }
});

module.exports = router;