/**
 * Procurement App Server
 * Central Kitchen Procurement Request Management
 *
 * Routes:
 *   GET  /                        → QR code landing page
 *   GET  /request                 → Submit request form
 *   GET  /requests                → All requests dashboard
 *   POST /api/requests            → Create request
 *   GET  /api/requests            → List all requests
 *   PATCH /api/requests/:id       → Update request (status/checklist)
 *   DELETE /api/requests/:id      → Delete request
 *   GET  /api/qr                  → Generate QR code PNG
 */

require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const path     = require('path');
const cors     = require('cors');
const QRCode   = require('qrcode');
const os       = require('os');

// Auto-detect local network IP for QR code
function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) return net.address;
        }
    }
    return 'localhost';
}

const app  = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/procurementapp';

// ─── MongoDB ─────────────────────────────────────────────────────────────────
mongoose.connect(MONGODB_URI)
    .then(() => console.log('✓ MongoDB connected'))
    .catch(err => console.error('✗ MongoDB error:', err));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static files ─────────────────────────────────────────────────────────────
const noCacheHtml = {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
    }
};
app.use(express.static(path.join(__dirname, 'procurement'), noCacheHtml));

// ─── Page routes ──────────────────────────────────────────────────────────────
app.get('/',           (req, res) => res.sendFile(path.join(__dirname, 'procurement', 'index.html')));
app.get('/request',    (req, res) => res.sendFile(path.join(__dirname, 'procurement', 'request-form.html')));
app.get('/requests',   (req, res) => res.sendFile(path.join(__dirname, 'procurement', 'requests.html')));

// ─── API routes ───────────────────────────────────────────────────────────────
const requestsRouter = require('./routes/requests');
app.use('/api/requests', requestsRouter);

// QR code — points to the request form URL
app.get('/api/qr', async (req, res) => {
    try {
        const base = process.env.QR_BASE_URL || `http://${getLocalIP()}:${PORT}`;
        const url  = `${base}/request`;
        const png  = await QRCode.toBuffer(url, { width: 400, margin: 2 });
        res.setHeader('Content-Type', 'image/png');
        res.send(png);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'QR generation failed' });
    }
});

// Serve uploaded images
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        db: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🛒  Procurement App`);
    console.log(`   Server running on http://localhost:${PORT}`);
    console.log(`   `);
    console.log(`   🏠 Landing / QR     → http://localhost:${PORT}/`);
    console.log(`   📋 Request Form     → http://localhost:${PORT}/request`);
    console.log(`   📊 All Requests     → http://localhost:${PORT}/requests`);
    console.log(`   💚 Health Check     → http://localhost:${PORT}/api/health`);
    console.log(`   📱 Scan QR at:       http://${getLocalIP()}:${PORT}/\n`);
});
