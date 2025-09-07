const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const fs = require('fs');
const multer = require('multer');

// Configure multer for photo uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName)
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('frontend'));
app.use('/uploads', express.static('uploads')); // Serve uploaded images

// In-memory blockchain simulation (simplified for demo)
// In a real implementation, this would be stored in a proper blockchain
let blockchain = [];
let herbRegistry = {};
let nextBlockId = 1;

// Helper function to create a new block
function createBlock(data, previousHash = null) {
    const block = {
        id: nextBlockId++,
        timestamp: new Date().toISOString(),
        data: data,
        previousHash: previousHash,
        hash: generateHash(data)
    };
    return block;
}

// Simple hash function (in real blockchain, this would be more sophisticated)
function generateHash(data) {
    return require('crypto')
        .createHash('sha256')
        .update(JSON.stringify(data) + Date.now())
        .digest('hex');
}

// API Routes

// 1. Collection Event - When farmers/collectors harvest herbs
app.post('/api/collect', upload.single('herbPhoto'), (req, res) => {
    try {
        const {
            collectorId,
            collectorName,
            herbSpecies,
            quantity,
            latitude,
            longitude,
            harvestDate,
            qualityNotes
        } = req.body;

        // Validate required fields
        if (!collectorId || !herbSpecies || !quantity || !latitude || !longitude) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }

        // Create collection event data
        const collectionData = {
            type: 'COLLECTION_EVENT',
            eventId: uuidv4(),
            collectorId,
            collectorName,
            herbSpecies,
            quantity: parseFloat(quantity),
            location: {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude)
            },
            harvestDate: harvestDate || new Date().toISOString(),
            qualityNotes,
            status: 'COLLECTED',
            photoPath: req.file ? `/uploads/${req.file.filename}` : null,
            photoOriginalName: req.file ? req.file.originalname : null
        };

        // Add to blockchain
        const previousHash = blockchain.length > 0 ? blockchain[blockchain.length - 1].hash : null;
        const newBlock = createBlock(collectionData, previousHash);
        blockchain.push(newBlock);

        // Store in registry for easy lookup
        herbRegistry[collectionData.eventId] = {
            ...collectionData,
            blockId: newBlock.id,
            chain: [newBlock.id]
        };

        console.log(`New collection event: ${herbSpecies} by ${collectorName}`);

        res.json({
            success: true,
            message: 'Collection event recorded successfully',
            eventId: collectionData.eventId,
            blockId: newBlock.id
        });

    } catch (error) {
        console.error('Collection error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// 2. Quality Test Event - When labs test the herbs
app.post('/api/quality-test', (req, res) => {
    try {
        const {
            eventId,
            laboratoryId,
            laboratoryName,
            testType,
            testResults,
            passed,
            testDate,
            notes
        } = req.body;

        if (!eventId || !laboratoryId || !testType || passed === undefined) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }

        // Check if event exists
        if (!herbRegistry[eventId]) {
            return res.status(404).json({ 
                success: false, 
                message: 'Collection event not found' 
            });
        }

        const qualityTestData = {
            type: 'QUALITY_TEST',
            testId: uuidv4(),
            eventId,
            laboratoryId,
            laboratoryName,
            testType,
            testResults,
            passed: Boolean(passed),
            testDate: testDate || new Date().toISOString(),
            notes
        };

        // Add to blockchain
        const previousHash = blockchain[blockchain.length - 1].hash;
        const newBlock = createBlock(qualityTestData, previousHash);
        blockchain.push(newBlock);

        // Update registry
        herbRegistry[eventId].chain.push(newBlock.id);
        herbRegistry[eventId].status = passed ? 'QUALITY_PASSED' : 'QUALITY_FAILED';

        res.json({
            success: true,
            message: 'Quality test recorded successfully',
            testId: qualityTestData.testId,
            blockId: newBlock.id
        });

    } catch (error) {
        console.error('Quality test error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// 3. Processing Event - When herbs are processed
app.post('/api/process', (req, res) => {
    try {
        const {
            eventId,
            processorId,
            processorName,
            processType,
            processDate,
            outputQuantity,
            notes
        } = req.body;

        if (!eventId || !processorId || !processType) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }

        if (!herbRegistry[eventId]) {
            return res.status(404).json({ 
                success: false, 
                message: 'Event not found' 
            });
        }

        const processData = {
            type: 'PROCESSING_EVENT',
            processId: uuidv4(),
            eventId,
            processorId,
            processorName,
            processType,
            processDate: processDate || new Date().toISOString(),
            outputQuantity: outputQuantity ? parseFloat(outputQuantity) : null,
            notes
        };

        const previousHash = blockchain[blockchain.length - 1].hash;
        const newBlock = createBlock(processData, previousHash);
        blockchain.push(newBlock);

        herbRegistry[eventId].chain.push(newBlock.id);
        herbRegistry[eventId].status = 'PROCESSED';

        res.json({
            success: true,
            message: 'Processing event recorded successfully',
            processId: processData.processId,
            blockId: newBlock.id
        });

    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// 4. Generate QR Code for final product
app.post('/api/generate-qr', async (req, res) => {
    try {
        const { eventId, productName, batchId } = req.body;

        if (!eventId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Event ID is required' 
            });
        }

        if (!herbRegistry[eventId]) {
            return res.status(404).json({ 
                success: false, 
                message: 'Event not found' 
            });
        }

        // Create QR data - Direct verification URL that opens in any QR scanner
        const verificationUrl = `http://localhost:${PORT}/verify?eventId=${eventId}`;
        
        // Generate QR code with direct URL (most scanners will open this directly)
        const qrCodeData = await QRCode.toDataURL(verificationUrl);
        
        // Also create detailed QR data for advanced scanners
        const qrData = {
            eventId,
            productName,
            batchId,
            verifyUrl: verificationUrl,
            type: 'AYURVEDIC_HERB_VERIFICATION'
        };

        // Update herb registry with product info
        herbRegistry[eventId].productName = productName;
        herbRegistry[eventId].batchId = batchId;
        herbRegistry[eventId].qrCode = qrCodeData;
        herbRegistry[eventId].status = 'PRODUCT_READY';

        res.json({
            success: true,
            message: 'QR Code generated successfully',
            qrCode: qrCodeData,
            verifyUrl: qrData.verifyUrl
        });

    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// 5. Verify/Trace product provenance
app.get('/api/trace/:eventId', (req, res) => {
    try {
        const { eventId } = req.params;

        if (!herbRegistry[eventId]) {
            return res.status(404).json({ 
                success: false, 
                message: 'Product not found' 
            });
        }

        const herb = herbRegistry[eventId];
        const traceData = [];

        // Get all blocks in the chain for this herb
        herb.chain.forEach(blockId => {
            const block = blockchain.find(b => b.id === blockId);
            if (block) {
                traceData.push({
                    blockId: block.id,
                    timestamp: block.timestamp,
                    type: block.data.type,
                    data: block.data
                });
            }
        });

        res.json({
            success: true,
            eventId,
            herbInfo: {
                species: herb.herbSpecies,
                status: herb.status,
                productName: herb.productName,
                batchId: herb.batchId
            },
            traceability: traceData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        });

    } catch (error) {
        console.error('Trace error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// 6. Get blockchain status/analytics
app.get('/api/blockchain/status', (req, res) => {
    res.json({
        success: true,
        totalBlocks: blockchain.length,
        totalHerbs: Object.keys(herbRegistry).length,
        recentBlocks: blockchain.slice(-5).map(block => ({
            id: block.id,
            timestamp: block.timestamp,
            type: block.data.type
        }))
    });
});

// 7. Advanced Analytics API
app.get('/api/analytics/overview', (req, res) => {
    try {
        const herbs = Object.values(herbRegistry);
        const blocks = blockchain;
        
        // Species distribution
        const speciesCount = {};
        herbs.forEach(herb => {
            speciesCount[herb.herbSpecies] = (speciesCount[herb.herbSpecies] || 0) + 1;
        });
        
        // Collection trends (last 7 days)
        const collectionTrends = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const count = herbs.filter(herb => 
                herb.harvestDate && herb.harvestDate.split('T')[0] === dateStr
            ).length;
            
            collectionTrends.push({
                date: dateStr,
                count: count
            });
        }
        
        // Quality test statistics
        const qualityTests = blocks.filter(block => block.data.type === 'QUALITY_TEST');
        const qualityStats = {
            total: qualityTests.length,
            passed: qualityTests.filter(test => test.data.passed).length,
            failed: qualityTests.filter(test => !test.data.passed).length
        };
        
        // Geographic data
        const locations = herbs.map(herb => ({
            lat: herb.location.latitude,
            lng: herb.location.longitude,
            species: herb.herbSpecies,
            collector: herb.collectorName,
            quantity: herb.quantity
        }));
        
        // Recent activity
        const recentActivity = blocks.slice(-10).map(block => ({
            id: block.id,
            type: block.data.type,
            timestamp: block.timestamp,
            details: getActivityDetails(block)
        }));
        
        res.json({
            success: true,
            analytics: {
                overview: {
                    totalHerbs: herbs.length,
                    totalBlocks: blocks.length,
                    totalCollectors: new Set(herbs.map(h => h.collectorId)).size,
                    totalQualityTests: qualityTests.length
                },
                speciesDistribution: speciesCount,
                collectionTrends,
                qualityStats,
                locations,
                recentActivity
            }
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, message: 'Analytics error' });
    }
});

function getActivityDetails(block) {
    switch (block.data.type) {
        case 'COLLECTION_EVENT':
            return `${block.data.herbSpecies} collected by ${block.data.collectorName}`;
        case 'QUALITY_TEST':
            return `Quality test ${block.data.passed ? 'PASSED' : 'FAILED'} - ${block.data.testType}`;
        case 'PROCESSING_EVENT':
            return `${block.data.processType} by ${block.data.processorName}`;
        default:
            return 'Blockchain event';
    }
}

// Serve static files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get('/collect', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'collect.html'));
});

app.get('/process', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'process.html'));
});

app.get('/verify/:eventId', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'verify.html'));
});

app.get('/verify', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'verify.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'dashboard.html'));
});

app.get('/analytics', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'analytics.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Ayurvedic Herb Traceability Server running on port ${PORT}`);
    console.log(`📱 Collection Interface: http://localhost:${PORT}/collect`);
    console.log(`🔍 Consumer Portal: http://localhost:${PORT}/verify`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/dashboard`);
    
    // Initialize with genesis block
    if (blockchain.length === 0) {
        const genesisBlock = createBlock({
            type: 'GENESIS',
            message: 'Ayurvedic Herb Traceability System Initialized'
        });
        blockchain.push(genesisBlock);
        console.log('✅ Genesis block created');
    }
});

module.exports = app;
