const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const logger = require('./utils/logger');

// Load environment variables from .env file
dotenv.config();

const analyzerService = require('./src');

const app = express();
const PORT = process.env.PORT || 6060;

app.use(cors());
// Use bodyParser for JSON with increased limit
app.use(bodyParser.json({limit: '10mb'}));

app.get('/', (req, res) => {
    res.send('cf-analyzer-service is running!');
});

app.post('/api/mappings', async (req, res) => {
    try {
        const {version} = req.query;
        const mappings = await analyzerService.analyzeDom(version);
        res.json(mappings);
    } catch (error) {
        logger.error('Error fetching mappings:', error);
        res.status(500).json({error: 'Failed to get mappings'});
    }
});

const server = app.listen(PORT, () => {
    logger.info(`CF Analyzer Service running on port ${PORT}`);
}).on('error', (err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});
