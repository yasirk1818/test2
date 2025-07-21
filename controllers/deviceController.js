const { Client, LocalAuth } = require('whatsapp-web.js');
const { io } = require('../server'); // Import io from server.js
const Device = require('../models/Device');
const Keyword = require('../models/Keyword');
const qrcode = require('qrcode');

const clients = {}; // Store active clients

// Function to initialize a WhatsApp client
const initializeWhatsAppClient = (deviceId, userId) => {
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: deviceId }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // VPS के लिए महत्वपूर्ण
        }
    });

    client.on('qr', async (qr) => {
        console.log(`QR RECEIVED for device ${deviceId}`);
        const qrCodeUrl = await qrcode.toDataURL(qr);
        io.to(userId).emit('qr', { deviceId, qrCodeUrl }); // Send QR to the specific user
    });

    client.on('ready', async () => {
        console.log(`Client is ready for device ${deviceId}!`);
        await Device.findByIdAndUpdate(deviceId, { status: 'connected' });
        io.to(userId).emit('status', { deviceId, status: 'connected' });
    });

    client.on('disconnected', async (reason) => {
        console.log(`Client was logged out for device ${deviceId}`, reason);
        await Device.findByIdAndUpdate(deviceId, { status: 'disconnected', session: null });
        delete clients[deviceId];
        io.to(userId).emit('status', { deviceId, status: 'disconnected' });
    });

    client.on('message', async (msg) => {
        // कीवर्ड के आधार पर ऑटो-रिप्लाई लॉजिक
        const keywords = await Keyword.find({ deviceId });
        const matchedKeyword = keywords.find(k => msg.body.toLowerCase() === k.keyword.toLowerCase());

        if (matchedKeyword) {
            client.sendMessage(msg.from, matchedKeyword.reply);
        }
    });

    client.initialize();
    clients[deviceId] = client;
};


exports.addDevice = async (req, res) => {
    const { name } = req.body;
    const userId = req.user.userId; // authMiddleware से

    try {
        const newDevice = new Device({ userId, name });
        await newDevice.save();

        initializeWhatsAppClient(newDevice._id.toString(), userId.toString());

        res.status(201).json({ message: "Device added. Scan QR code.", device: newDevice });
    } catch (error) {
        res.status(500).json({ message: "Error adding device", error });
    }
};

// अन्य कंट्रोलर्स (getDevices, deleteDevice, etc.) यहाँ जोड़े जाएंगे
