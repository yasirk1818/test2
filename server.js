const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");
const socketIo = require("socket.io");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// DB Connect
mongoose.connect(process.env.MONGO_URI).then(() => console.log("MongoDB Connected"));

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/device", require("./routes/deviceRoutes"));
app.use("/api/keyword", require("./routes/keywordRoutes"));

// WhatsApp Socket Integration
require("./whatsapp/clientManager")(io);

server.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
