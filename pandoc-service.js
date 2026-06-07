const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 8080;
const workspaceDir = '/workspace';
const PANDOC_INTERNAL_TOKEN = process.env.PANDOC_INTERNAL_TOKEN;

if (!PANDOC_INTERNAL_TOKEN) {
    console.error('FATAL: PANDOC_INTERNAL_TOKEN environment variable is required.');
    process.exit(1);
}

if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, workspaceDir),
    filename: (req, file, cb) => cb(null, `${uuidv4()}.md`),
});
const upload = multer({ storage });

app.use(express.json({ limit: '2mb' }));

// Health check stays public for container/k8s probes.
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'pandoc-service', timestamp: new Date().toISOString() });
});

// Shared-secret auth for the conversion endpoint.
function requireInternalToken(req, res, next) {
    const header = req.get('authorization') || '';
    const expected = `Bearer ${PANDOC_INTERNAL_TOKEN}`;
    if (header.length !== expected.length || header !== expected) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// Restrict LaTeX file I/O at the engine level.
const pandocEnv = {
    ...process.env,
    openin_any: 'p',
    openout_any: 'p',
    shell_escape: 'f',
    TEXMFOUTPUT: workspaceDir,
};

app.post('/convert', requireInternalToken, upload.single('markdown'), async (req, res) => {
    let inputFile;
    let outputFile;

    try {
        const { orientation = 'portrait' } = req.body;

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

        // Pandoc args:
        //  -f markdown-raw_tex  → strip embedded raw LaTeX so user markdown can't
        //                         reach LuaLaTeX with \input{}, \directlua{}, etc.
        const pandocArgs = [
            inputFile,
            '-o', outputFile,
            '-f', 'markdown-raw_tex',
            '--pdf-engine=lualatex',
            '-V', `geometry:${geometryOption}`,
            '--template', '/assets/eisvogel.tex',
            '--number-sections',
            '--variable', 'caption-justification=centering',
            '-V', 'mainfont=sourcesanspro',
            '-V', 'sansfont=sourcesanspro',
            '-V', 'monofont=sourcecodepro',
            '-V', 'emoji-font=Noto Color Emoji',
        ];

        execFile('pandoc', pandocArgs, { env: pandocEnv }, (error, stdout, stderr) => {
            if (error) {
                console.error('Pandoc execution error:', { message: error.message, stderr });
                fs.unlink(inputFile, () => {});
                return res.status(500).json({ error: 'Conversion failed' });
            }

            if (!fs.existsSync(outputFile)) {
                console.error('Pandoc produced no output file', { inputFile, outputFile });
                fs.unlink(inputFile, () => {});
                return res.status(500).json({ error: 'Conversion failed' });
            }

            res.setHeader('Content-Type', 'application/pdf');
            const timestamp = Math.floor(Date.now() / 1000);
            res.setHeader('Content-Disposition', `attachment; filename="markdown${timestamp}.pdf"`);

            const stream = fs.createReadStream(outputFile);
            stream.pipe(res);

            const cleanup = () => {
                fs.unlink(inputFile, () => {});
                fs.unlink(outputFile, () => {});
            };
            stream.on('end', cleanup);
            stream.on('close', cleanup);
            stream.on('error', (streamError) => {
                console.error('Stream error:', streamError);
                cleanup();
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Conversion failed' });
                }
            });
        });

    } catch (err) {
        console.error('File operation error:', err);
        if (inputFile) fs.unlink(inputFile, () => {});
        if (outputFile) fs.unlink(outputFile, () => {});
        res.status(500).json({ error: 'Conversion failed' });
    }
});

app.listen(port, () => {
    console.log(`Pandoc service running on port ${port}`);
});
