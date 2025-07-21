const mongoose = require('mongoose');

const DeviceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    status: { type: String, enum: ['connected', 'disconnected'], default: 'disconnected' },
    session: { type: Object },
    features: {
        autoTyping: { type: Boolean, default: false },
        autoRead: { type: Boolean, default: false },
        alwaysOnline: { type: Boolean, default: false },
        antiDelete: { type: Boolean, default: false },
        viewOnce: { type: Boolean, default: false },
        rejectCalls: { type: Boolean, default: false },
        ghostMode: { type: Boolean, default: false }
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Device', DeviceSchema);
