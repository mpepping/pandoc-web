const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const FormData = require('form-data');
const fetch = require('node-fetch');

const app = express();
const port = 3000;
const tempDir = path.join(__dirname, 'temp');
const PANDOC_SERVICE_URL = process.env.PANDOC_SERVICE_URL || 'http://localhost:8080';

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

app.use(express.json());
app.use(express.static('.'));

app.post('/convert', async (req, res) => {
    const { markdown, orientation = 'portrait' } = req.body;

    if (!markdown) {
        return res.status(400).send('No markdown content provided');
    }

    try {
        const response = await fetch(`${PANDOC_SERVICE_URL}/convert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                markdown,
                orientation
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Pandoc service error:', errorData);
            return res.status(response.status).send(`Conversion failed: ${errorData.error || 'Unknown error'}`);
        }

        // Set headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        const timestamp = Math.floor(Date.now() / 1000);
        res.setHeader('Content-Disposition', `attachment; filename="markdown${timestamp}.pdf"`);

        // Pipe the PDF response directly to the client
        response.body.pipe(res);

    } catch (err) {
        console.error('Request to pandoc service failed:', err);
        res.status(500).send(`Service communication failed: ${err.message}`);
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
    console.log(`Pandoc Web server running at http://localhost:${port}`);
    console.log(`Using pandoc service at: ${PANDOC_SERVICE_URL}`);
});
