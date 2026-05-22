const express = require('express');
const router = express.Router();
const WebSocket = require('ws');
const User = require('../models/User');
const Message = require('../models/Message');

// Kullanıcı Bilgisi Çekme
router.get('/my-info/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({});
        res.json({ displayId: user.displayId });
    } catch (e) { res.status(500).json({}); }
});

// Kullanıcı Adı Değiştirme
router.post('/update-username', async (req, res) => {
    try {
        const { oldUsername, newUsername } = req.body;
        if (oldUsername === newUsername) return res.status(400).json({ message: "Zaten bu ismi kullanıyorsun!" });
        const existingUser = await User.findOne({ username: newUsername });
        if (existingUser) return res.status(400).json({ message: "İsim başkasına ait!" });
        await User.updateOne({ username: oldUsername }, { $set: { username: newUsername } });
        await Message.updateMany({ sender: oldUsername }, { $set: { sender: newUsername } });
        res.status(200).json({ message: "Kullanıcı adı güncellendi!", username: newUsername });
    } catch (err) { res.status(500).json({ message: "Hata oluştu!" }); }
});

// Şifre Değiştirme
router.post('/update-password', async (req, res) => {
    try {
        const { username, oldPassword, newPassword } = req.body;
        const user = await User.findOne({ username });
        if (!user || user.password !== oldPassword) return res.status(400).json({ message: "Eski şifre yanlış!" });
        await User.updateOne({ username }, { $set: { password: newPassword } });
        res.status(200).json({ message: "Şifre değiştirildi!" });
    } catch (err) { res.status(500).json({ message: "Hata oluştu!" }); }
});

// Arkadaşlık İsteği Atma
router.post('/send-friend-request', async (req, res) => {
    try {
        const { username, friendId } = req.body;
        const sender = await User.findOne({ username });
        if (sender.displayId === friendId.trim().toUpperCase()) return res.status(400).json({ message: "Kendine istek atamazsın!" });
        const receiver = await User.findOne({ displayId: friendId.trim().toUpperCase() });
        if (!receiver) return res.status(404).json({ message: "Böyle bir ID yok!" });
        if (sender.friends.includes(receiver.displayId)) return res.status(400).json({ message: "Zaten arkadaşın!" });
        if (receiver.friendRequests.includes(sender.displayId)) return res.status(400).json({ message: "İstek beklemede!" });
        await User.updateOne({ displayId: receiver.displayId }, { $addToSet: { friendRequests: sender.displayId } });
        res.status(200).json({ message: `İstek gönderildi!` });
    } catch (err) { res.status(500).json({ message: "Hata oluştu!" }); }
});

// Gelen İstekleri Çekme
router.get('/friend-requests/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.json([]);
        const requests = await User.find({ displayId: { $in: user.friendRequests } }, 'username displayId');
        res.json(requests);
    } catch (err) { res.status(500).json([]); }
});

// Arkadaşlık İsteği Kabul Etme
router.post('/accept-friend-request', async (req, res) => {
    try {
        const { username, senderId } = req.body;
        const receiver = await User.findOne({ username });
        await User.updateOne({ username }, { $pull: { friendRequests: senderId }, $addToSet: { friends: senderId } });
        await User.updateOne({ displayId: senderId }, { $addToSet: { friends: receiver.displayId } });
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ message: "Kabul edilemedi" }); }
});

// Arkadaşlık İsteği Reddetme
router.post('/reject-friend-request', async (req, res) => {
    try {
        const { username, senderId } = req.body;
        await User.updateOne({ username }, { $pull: { friendRequests: senderId } });
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ message: "Reddedilemedi" }); }
});

// Arkadaş Silme
router.post('/remove-friend', async (req, res) => {
    try {
        const { username, friendId } = req.body;
        const user = await User.findOne({ username });
        await User.updateOne({ username }, { $pull: { friends: friendId } });
        await User.updateOne({ displayId: friendId }, { $pull: { friends: user.displayId } });
        res.status(200).json({ success: true });
    } catch (err) { res.status(500).json({ message: "Silinemedi" }); }
});

// Arkadaş Listesi ve Çevrimiçi Kontrolü
router.get('/friends/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.json([]);
        const friendsList = await User.find({ displayId: { $in: user.friends } }, 'username displayId');

        const onlineUsers = req.app.get('onlineUsers');
        const mappedFriends = friendsList.map(f => ({
            username: f.username,
            displayId: f.displayId,
            isOnline: onlineUsers.has(f.username)
        }));

        res.json(mappedFriends);
    } catch (err) { res.status(500).json([]); }
});

// Anlık Canlı Çalışma Alanı Daveti Gönderme
router.post('/send-invite', (req, res) => {
    const { sender, targetUsername, roomId, roomName } = req.body;
    const onlineUsers = req.app.get('onlineUsers');
    const targetWs = onlineUsers.get(targetUsername);

    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
        targetWs.send(JSON.stringify({ type: 'invite_received', sender, roomId, roomName }));
        res.json({ success: true });
    } else {
        res.status(404).json({ message: "Kullanıcı şu an çevrimdışı!" });
    }
});

module.exports = router;