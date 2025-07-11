const { Client, LocalAuth, Buttons, List } = require('whatsapp-web.js');
const express = require('express');
const { Server } = require("socket.io");
const http = require('http');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

const menuPath = path.join(__dirname, 'menu.json');

const readMenu = () => JSON.parse(fs.readFileSync(menuPath));
const writeMenu = (data) => fs.writeFileSync(menuPath, JSON.stringify(data, null, 2));

const sessions = new Map();

// --- WEB & API ROUTES ---
app.get('/', (req, res) => res.sendFile('index.html', { root: __dirname }));
app.get('/admin', (req, res) => res.sendFile('admin.html', { root: __dirname }));
app.get('/api/menu', (req, res) => res.json(readMenu()));
app.post('/api/category', (req, res) => { /* ... (Same as previous code) */ });
app.post('/api/item', (req, res) => { /* ... (Same as previous code) */ });
app.delete('/api/item/:categoryId/:itemId', (req, res) => { /* ... (Same as previous code) */ });
app.delete('/api/category/:categoryId', (req, res) => { /* ... (Same as previous code) */ });

// (Pasting the full API logic here for completeness)
app.post('/api/category', (req, res) => {
    const { id, title } = req.body;
    const menu = readMenu();
    if (!menu[id]) {
        menu[id] = { title, items: [] };
        writeMenu(menu);
        res.status(201).send({ message: 'Category added' });
    } else {
        res.status(400).send({ message: 'Category ID already exists' });
    }
});
app.post('/api/item', (req, res) => {
    const { categoryId, name, price } = req.body;
    const menu = readMenu();
    if (menu[categoryId]) {
        const newItem = { id: `item_${Date.now()}`, name, price };
        menu[categoryId].items.push(newItem);
        writeMenu(menu);
        res.status(201).send({ message: 'Item added' });
    } else {
        res.status(404).send({ message: 'Category not found' });
    }
});
app.delete('/api/item/:categoryId/:itemId', (req, res) => {
    const { categoryId, itemId } = req.params;
    const menu = readMenu();
    if (menu[categoryId]) {
        menu[categoryId].items = menu[categoryId].items.filter(item => item.id !== itemId);
        writeMenu(menu);
        res.status(200).send({ message: 'Item deleted' });
    } else {
        res.status(404).send({ message: 'Category not found' });
    }
});
app.delete('/api/category/:categoryId', (req, res) => {
    const { categoryId } = req.params;
    const menu = readMenu();
    if (menu[categoryId]) {
        delete menu[categoryId];
        writeMenu(menu);
        res.status(200).send({ message: 'Category deleted' });
    } else {
        res.status(404).send({ message: 'Category not found' });
    }
});


// --- WHATSAPP BOT HELPERS ---
const getMainMenu = () => new List('Please choose from our menu.', 'View Menu', [{ title: 'Select a category', rows: Object.keys(readMenu()).map(key => ({ id: `cat_${key}`, title: readMenu()[key].title })) }], 'Hotel Bot Menu');
const getCategoryMenu = (categoryKey) => {
    const category = readMenu()[categoryKey];
    return new List(`Here are our ${category.title}.`, 'View Items', [{ title: category.title, rows: category.items.map(item => ({ id: `item_${categoryKey}_${item.id}`, title: item.name, description: `Rs. ${item.price}` })) }], `${category.title} Menu`);
};

// --- SESSION CREATION & BOT LOGIC ---
const createSession = (sessionId) => {
    console.log(`Creating session: ${sessionId}`);
    const client = new Client({ authStrategy: new LocalAuth({ clientId: sessionId }), puppeteer: { headless: true, args: ['--no-sandbox'] } });

    client.on('qr', (qr) => qrcode.toDataURL(qr, (err, url) => io.to(sessionId).emit('qr', url)));
    client.on('ready', () => {
        io.to(sessionId).emit('status', `Connected! Send 'menu' or 'hi' to start ordering.`);
        io.to(sessionId).emit('qr', null);
    });

    client.on('message', async (message) => {
        const chatId = message.from;
        const sessionData = sessions.get(sessionId);
        if (!sessionData || message.from.endsWith('@g.us') || message.fromMe) return;

        const handleTextMessage = async (text) => { /* ... */ }; // Placeholder

        if (message.type === 'chat') {
            const lowerCaseText = message.body.toLowerCase();
            const menu = readMenu();
            let itemsFound = [];

            for (const categoryKey in menu) {
                menu[categoryKey].items.forEach(item => {
                    if (lowerCaseText.includes(item.name.toLowerCase())) {
                        itemsFound.push({ ...item, categoryKey });
                    }
                });
            }

            if (itemsFound.length === 1) {
                const item = itemsFound[0];
                sessionData.cart.push(item);
                sessionData.state = 'item_added';
                client.sendMessage(chatId, new Buttons(`Added ${item.name} to your cart.`, [{ body: 'Add More' }, { body: 'Checkout' }], 'What next?'));
            } else if (itemsFound.length > 1) {
                sessionData.state = 'selecting_from_keyword';
                const rows = itemsFound.map(item => ({ id: `item_${item.categoryKey}_${item.id}`, title: item.name, description: `Rs. ${item.price}` }));
                client.sendMessage(chatId, new List(`We have a few options for "${message.body}". Please choose one:`, 'Select Item', [{ title: 'Matching Items', rows }], 'Choose an Item'));
            } else if (lowerCaseText.includes('menu') || lowerCaseText.includes('hi')) {
                sessionData.state = 'main_menu';
                sessionData.cart = [];
                client.sendMessage(chatId, getMainMenu());
            } else {
                // If it's not a keyword, check the state (e.g., for address)
                if (sessionData.state === 'awaiting_address') {
                    const address = message.body;
                    client.sendMessage(chatId, `Thank you! Your order will be delivered to:\n\n*${address}*\n\nYour order is being processed.`);
                    console.log(`NEW ORDER from ${chatId}:`, { cart: sessionData.cart, address: address });
                    sessionData.state = 'start';
                    sessionData.cart = [];
                } else {
                    client.sendMessage(chatId, "I'm sorry, I didn't understand. You can type 'menu' to see all our options.");
                }
            }
        } else if (message.selectedRowId || message.body) { // Handles List and Button replies
            switch (sessionData.state) {
                case 'main_menu':
                case 'selecting_from_keyword':
                case 'selecting_item':
                    if (message.selectedRowId) {
                        const [_, categoryKey, itemId] = message.selectedRowId.split('_');
                        const item = readMenu()[categoryKey]?.items.find(i => i.id === itemId);
                        if(item) {
                            sessionData.cart.push(item);
                            sessionData.state = 'item_added';
                            client.sendMessage(chatId, new Buttons(`Added ${item.name} to your cart.`, [{ body: 'Add More' }, { body: 'Checkout' }], 'What next?'));
                        }
                    }
                    break;
                case 'item_added':
                    if (message.body.toLowerCase() === 'add more') {
                        sessionData.state = 'main_menu';
                        client.sendMessage(chatId, getMainMenu());
                    } else if (message.body.toLowerCase() === 'checkout') {
                        sessionData.state = 'confirming_order';
                        let orderSummary = 'Your Order:\n\n';
                        let total = 0;
                        sessionData.cart.forEach(item => {
                            orderSummary += `${item.name} - Rs. ${item.price}\n`;
                            total += item.price;
                        });
                        orderSummary += `\n*Total: Rs. ${total}*`;
                        client.sendMessage(chatId, new Buttons(orderSummary, [{ body: 'Confirm Order' }, { body: 'Cancel' }], 'Please confirm.'));
                    }
                    break;
                case 'confirming_order':
                    if (message.body.toLowerCase() === 'confirm order') {
                        sessionData.state = 'awaiting_address';
                        client.sendMessage(chatId, 'Great! Please type your delivery address.');
                    } else if (message.body.toLowerCase() === 'cancel') {
                        sessionData.state = 'start';
                        sessionData.cart = [];
                        client.sendMessage(chatId, 'Your order has been cancelled. Type "menu" to start again.');
                    }
                    break;
            }
        }
    });

    client.initialize();
    sessions.set(sessionId, { client: client, state: 'start', cart: [] });
};

io.on('connection', (socket) => {
    socket.on('create-session', () => {
        const sessionId = `session-${Date.now()}`;
        createSession(sessionId);
        socket.emit('session-created', sessionId);
    });
    socket.on('join-session', (sessionId) => { socket.join(sessionId); });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}. Admin panel at http://localhost:${PORT}/admin`));
