const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 8080;
const workspaceDir = '/workspace';

// Ensure workspace directory exists
if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, workspaceDir);
    },
    filename: (req, file, cb) => {
        const sessionId = uuidv4();
        cb(null, `${sessionId}.md`);
    }
});
const upload = multer({ storage });

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'pandoc-service', timestamp: new Date().toISOString() });
});

// Convert markdown to PDF endpoint
app.post('/convert', upload.single('markdown'), async (req, res) => {
    let inputFile;
    let outputFile;

    try {
        const { orientation = 'portrait' } = req.body;
        
        // Handle file upload or direct markdown content
        if (req.file) {
            inputFile = req.file.path;
        } else if (req.body.markdown) {
            const sessionId = uuidv4();
            inputFile = path.join(workspaceDir, `${sessionId}.md`);
            fs.writeFileSync(inputFile, req.body.markdown);
        } else {
            return res.status(400).json({ error: 'No markdown content provided' });
        }

        const sessionId = path.basename(inputFile, '.md');
        outputFile = path.join(workspaceDir, `${sessionId}.pdf`);

        const geometryOption = orientation === 'landscape' ? 'a4paper,landscape' : 'a4paper';

        // Run pandoc command with full styling options
        const pandocCmd = `pandoc "${inputFile}" -o "${outputFile}" --pdf-engine=lualatex -V geometry:${geometryOption} --template /assets/eisvogel.tex --number-sections --variable caption-justification=centering -V mainfont="sourcesanspro" -V sansfont="sourcesanspro" -V monofont="sourcecodepro" -V emoji-font="Noto Color Emoji"`;

        exec(pandocCmd, (error, stdout, stderr) => {
            if (error) {
                console.error('Pandoc execution error:', error);
                console.error('stderr:', stderr);

                // Cleanup
                fs.unlink(inputFile, () => {});

                return res.status(500).json({
                    error: 'Conversion failed',
                    details: error.message,
                    stderr: stderr
                });
            }

            if (!fs.existsSync(outputFile)) {
                fs.unlink(inputFile, () => {});
                return res.status(500).json({ error: 'PDF file was not generated' });
            }

            // Stream the PDF file
            res.setHeader('Content-Type', 'application/pdf');
            const timestamp = Math.floor(Date.now() / 1000);
            res.setHeader('Content-Disposition', `attachment; filename="markdown${timestamp}.pdf"`);

            const stream = fs.createReadStream(outputFile);
            stream.pipe(res);

            stream.on('end', () => {
                // Cleanup temporary files
                fs.unlink(inputFile, () => {});
                fs.unlink(outputFile, () => {});
            });

            stream.on('error', (streamError) => {
                console.error('Stream error:', streamError);
                fs.unlink(inputFile, () => {});
                fs.unlink(outputFile, () => {});
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error streaming PDF file' });
                }
            });
        });

    } catch (err) {
        console.error('File operation error:', err);
        if (inputFile) fs.unlink(inputFile, () => {});
        if (outputFile) fs.unlink(outputFile, () => {});
        res.status(500).json({ error: 'File operation failed', details: err.message });
    }
});

app.listen(port, () => {
    console.log(`Pandoc service running on port ${port}`);
});