const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Kayıt Olma API
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) return res.status(400).json({ message: "Kullanıcı adı veya e-posta zaten kullanımda!" });

        const newDisplayId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const newUser = new User({ username, email, password, displayId: newDisplayId });
        await newUser.save();
        res.status(201).json({ message: "Kayıt başarılı! Giriş yapabilirsin." });
    } catch (err) { res.status(500).json({ message: "Sunucuda kayıt hatası!" }); }
});

// Giriş Yapma API
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
        if (!user || user.password !== password) return res.status(400).json({ message: "Bilgileri yanlış girdin!" });
        if (!user.displayId) {
            user.displayId = Math.random().toString(36).substring(2, 8).toUpperCase();
            await user.save();
        }
        res.status(200).json({ message: "Giriş başarılı...", username: user.username, displayId: user.displayId });
    } catch (err) { res.status(500).json({ message: "Sunucuda giriş hatası!" }); }
});

module.exports = router;