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

app.post('/api/analyze', async (req, res) => {
    const {html, selector} = req.body;
    try {
        const alternatives = await analyzerService.analyzeDOM(html, selector);
        res.json(alternatives);
    } catch (error) {
        logger.error('Error:', error);
        res.status(500).json({error: 'Failed to get alternatives'});
    }
});

app.listen(PORT, () => {
    logger.info(`CF Analyzer Service running on port ${PORT}`);
}).on('error', (err) => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});
