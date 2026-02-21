const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const ProcurementRequest = require('../models/ProcurementRequest');

// Multer setup (reuse server upload dir)
const uploadDir = path.join(__dirname, '..', 'uploads');
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename:    (req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, `${Date.now()}-${safe}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

/**
 * POST /api/requests
 * Create a new procurement request (multipart/form-data for image)
 */
router.post('/', upload.single('image'), async (req, res) => {
    try {
        const data = { ...req.body };
        if (req.file) data.imagePath = `/uploads/${req.file.filename}`;

        // Parse checklist if sent as JSON string
        if (typeof data.checklist === 'string') {
            try { data.checklist = JSON.parse(data.checklist); } catch (_) {}
        }

        const request = new ProcurementRequest(data);
        await request.save();
        res.status(201).json(request);
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * GET /api/requests
 * Get all requests — optional ?status=Pending&priority=High&search=...
 */
router.get('/', async (req, res) => {
    try {
        const filter = {};
        if (req.query.status)   filter.status   = req.query.status;
        if (req.query.priority) filter.priority  = req.query.priority;
        if (req.query.category) filter.category  = req.query.category;
        if (req.query.search) {
            const rx = new RegExp(req.query.search, 'i');
            filter.$or = [{ itemNameEn: rx }, { itemNameZh: rx }, { requestorName: rx }, { department: rx }];
        }
        const requests = await ProcurementRequest.find(filter).sort({ createdAt: -1 });
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/requests/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const r = await ProcurementRequest.findById(req.params.id);
        if (!r) return res.status(404).json({ error: 'Not found' });
        res.json(r);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /api/requests/:id
 * Update status, checklist, purchaser notes
 */
router.patch('/:id', async (req, res) => {
    try {
        const updates = { ...req.body, updatedAt: new Date() };
        const r = await ProcurementRequest.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true }
        );
        if (!r) return res.status(404).json({ error: 'Not found' });
        res.json(r);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * DELETE /api/requests/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const r = await ProcurementRequest.findByIdAndDelete(req.params.id);
        if (!r) return res.status(404).json({ error: 'Not found' });
        // Delete uploaded image if exists
        if (r.imagePath) {
            const imgFile = path.join(__dirname, '..', r.imagePath);
            fs.unlink(imgFile, () => {});
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
