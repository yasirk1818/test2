const mongoose = require('mongoose');

const KeywordSchema = new mongoose.Schema({
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device' },
    keyword: { type: String, required: true },
    reply: { type: String, required: true }
});

module.exports = mongoose.model('Keyword', KeywordSchema);
