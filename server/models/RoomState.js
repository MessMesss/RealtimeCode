const mongoose = require('mongoose');

const roomStateSchema = new mongoose.Schema({
    roomId: { type: String, required: true, unique: true },
    roomName: { type: String, default: 'İsimsiz Oda' },
    codeState: Buffer
});

module.exports = mongoose.model('RoomState', roomStateSchema);