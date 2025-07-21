import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = 'http://localhost:5000'; // Aapke backend ka URL

const Dashboard = () => {
    const [devices, setDevices] = useState([]);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [selectedDeviceId, setSelectedDeviceId] = useState(null);
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) {
            navigate('/login'); // Agar login nahi hai to login page par bhej do
            return;
        }

        const socket = io(API_URL);
        const userId = localStorage.getItem('userId');

        socket.on('connect', () => {
            console.log('Socket server se connect ho gaya');
            // Server ko batana ki is user ne join kiya hai
            socket.emit('join', userId);
        });

        socket.on('qr', ({ deviceId, qrCodeUrl }) => {
            console.log(`QR mila hai ${deviceId} ke liye`);
            setSelectedDeviceId(deviceId);
            setQrCodeUrl(qrCodeUrl);
            setStatusMessage('Please scan the QR code with your WhatsApp.');
        });

        socket.on('status', ({ deviceId, status, message }) => {
            console.log(`Status update for ${deviceId}: ${status}`);
            setStatusMessage(message);
            if (status === 'connected') {
                setQrCodeUrl(''); // Connect hone par QR code hata do
            }
            // Yahan aap devices ki list ko update kar sakte hain
        });

        return () => {
            socket.disconnect(); // Component ke hatne par connection band kar do
        };
    }, [token, navigate]);

    const handleAddDevice = async () => {
        try {
            const deviceName = prompt("Apne device ke liye ek naam dein:");
            if (deviceName) {
                setQrCodeUrl('');
                setStatusMessage('Generating QR Code, please wait...');
                await axios.post(`${API_URL}/api/devices/add`, 
                    { name: deviceName },
                    { headers: { 'x-auth-token': token } }
                );
            }
        } catch (error) {
            console.error('Device add karne me error', error);
            setStatusMessage('Error adding device. Please try again.');
        }
    };

    return (
        <div>
            <h1>Dashboard</h1>
            <button onClick={handleAddDevice}>Add New Device</button>
            
            {/* Devices ki list yahan dikhayi ja sakti hai */}
            
            {statusMessage && <p><strong>Status:</strong> {statusMessage}</p>}

            {qrCodeUrl && (
                <div>
                    <h3>Scan this QR Code</h3>
                    <img src={qrCodeUrl} alt="WhatsApp QR Code" />
                </div>
            )}
        </div>
    );
};

export default Dashboard;
