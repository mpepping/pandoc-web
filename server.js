const express = require('express');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const app = express();
const port = 3000;
const tempDir = path.join(__dirname, 'temp');
const PANDOC_SERVICE_URL = process.env.PANDOC_SERVICE_URL || 'http://localhost:8080';
const PANDOC_INTERNAL_TOKEN = process.env.PANDOC_INTERNAL_TOKEN;

if (!PANDOC_INTERNAL_TOKEN) {
    console.error('FATAL: PANDOC_INTERNAL_TOKEN environment variable is required.');
    process.exit(1);
}

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/convert', async (req, res) => {
    const { markdown, orientation = 'portrait', format = 'pdf' } = req.body;

    if (!markdown) {
        return res.status(400).json({ error: 'No markdown content provided' });
    }

    const outputFormat = format === 'epub' ? 'epub' : 'pdf';

    try {
        const response = await fetch(`${PANDOC_SERVICE_URL}/convert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PANDOC_INTERNAL_TOKEN}`,
            },
            body: JSON.stringify({ markdown, orientation, format: outputFormat })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Pandoc service error:', { status: response.status, body: errorData });
            return res.status(502).json({ error: 'Conversion failed' });
        }

        const contentType = outputFormat === 'epub' ? 'application/epub+zip' : 'application/pdf';
        res.setHeader('Content-Type', contentType);
        const timestamp = Math.floor(Date.now() / 1000);
        res.setHeader('Content-Disposition', `attachment; filename="markdown${timestamp}.${outputFormat}"`);

        if (response.body && response.body.getReader) {
            Readable.fromWeb(response.body).pipe(res);
        } else if (response.body && response.body.pipe) {
            response.body.pipe(res);
        } else {
            res.send(Buffer.from(await response.arrayBuffer()));
        }

    } catch (err) {
        console.error('Request to pandoc service failed:', err);
        res.status(502).json({ error: 'Conversion failed' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
    console.log(`Pandoc Web server running at http://localhost:${port}`);
    console.log(`Using pandoc service at: ${PANDOC_SERVICE_URL}`);
});
