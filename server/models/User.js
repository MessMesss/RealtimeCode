const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    displayId: { type: String, unique: true },
    joinedRooms: { type: [String], default: [] },
    friends: { type: [String], default: [] },
    friendRequests: { type: [String], default: [] }
});

module.exports = mongoose.model('User', userSchema);