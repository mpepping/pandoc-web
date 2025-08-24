const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;
const tempDir = path.join(__dirname, 'temp');

if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
}

app.use(express.json());
app.use(express.static('.'));

app.post('/convert', async (req, res) => {
    const { markdown } = req.body;

    if (!markdown) {
        return res.status(400).send('No markdown content provided');
    }

    const sessionId = uuidv4();
    const inputFile = path.join(tempDir, `${sessionId}.md`);
    const outputFile = path.join(tempDir, `${sessionId}.pdf`);

    try {
        fs.writeFileSync(inputFile, markdown);

        const dockerCmd = `docker run --rm -v "${tempDir}:/workspace" -v "${path.join(__dirname, 'assets')}:/assets" ghcr.io/mpepping/pandoc:latest -f markdown -t pdf --pdf-engine=lualatex -V geometry:a4paper --template /assets/eisvogel.tex --number-sections --variable caption-justification=centering -V mainfont="sourcesanspro" -V sansfont="sourcesanspro" -V monofont="sourcecodepro" -V emoji-font="Noto Color Emoji" -o /workspace/${sessionId}.pdf /workspace/${sessionId}.md`;

        exec(dockerCmd, (error, stdout, stderr) => {
            if (error) {
                console.error('Docker execution error:', error);
                console.error('stderr:', stderr);

                fs.unlink(inputFile, () => {});

                return res.status(500).send(`Conversion failed: ${error.message}`);
            }

            if (!fs.existsSync(outputFile)) {
                fs.unlink(inputFile, () => {});
                return res.status(500).send('PDF file was not generated');
            }

            res.setHeader('Content-Type', 'application/pdf');
            const timestamp = Math.floor(Date.now() / 1000);
            res.setHeader('Content-Disposition', `attachment; filename="markdown${timestamp}.pdf"`);

            const stream = fs.createReadStream(outputFile);
            stream.pipe(res);

            stream.on('end', () => {
                fs.unlink(inputFile, () => {});
                fs.unlink(outputFile, () => {});
            });

            stream.on('error', (streamError) => {
                console.error('Stream error:', streamError);
                fs.unlink(inputFile, () => {});
                fs.unlink(outputFile, () => {});
                if (!res.headersSent) {
                    res.status(500).send('Error streaming PDF file');
                }
            });
        });

    } catch (err) {
        console.error('File operation error:', err);
        res.status(500).send(`File operation failed: ${err.message}`);
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
    console.log(`Pandoc Web server running at http://localhost:${port}`);
    console.log(`Make sure Docker is running and you have access to ghcr.io/mpepping/pandoc:latest`);
});
