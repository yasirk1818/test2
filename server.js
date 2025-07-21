// server.js
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/device');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // आपके React ऐप का URL
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB Connected'))
    .catch(err => console.log(err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);

// Socket.io Connection
io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// whatsapp-web.js और socket.io को एक्सपोर्ट करें ताकि कंट्रोलर्स में इस्तेमाल किया जा सके
module.exports = { io };
