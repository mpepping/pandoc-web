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

// EPUB requires a non-empty <title>; without one Pandoc falls back to the
// literal string "UNTITLED". Detect whether the document already sets a title
// and, if not, derive one from the first H1 heading (or a generic default).
function frontmatterHasTitle(markdown) {
    const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return match ? /^title\s*:\s*\S/m.test(match[1]) : false;
}

function deriveTitle(markdown) {
    const body = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
    const heading = body.match(/^#\s+(.+?)\s*#*\s*$/m);
    return heading ? heading[1].trim() : 'Untitled Document';
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
        const { orientation = 'portrait', format = 'pdf' } = req.body;
        const outputFormat = format === 'epub' ? 'epub' : 'pdf';

        let markdownContent;
        if (req.file) {
            inputFile = req.file.path;
            markdownContent = fs.readFileSync(inputFile, 'utf8');
        } else if (req.body.markdown) {
            markdownContent = req.body.markdown;
            const sessionId = uuidv4();
            inputFile = path.join(workspaceDir, `${sessionId}.md`);
            fs.writeFileSync(inputFile, markdownContent);
        } else {
            return res.status(400).json({ error: 'No markdown content provided' });
        }

        const sessionId = path.basename(inputFile, '.md');
        outputFile = path.join(workspaceDir, `${sessionId}.${outputFormat}`);

        let pandocArgs;
        if (outputFormat === 'epub') {
            // EPUB is HTML-based, so the LaTeX template/engine and page geometry
            // don't apply. Frontmatter (title/author/date) is mapped to EPUB
            // metadata automatically; --toc gives readers a navigation document.
            //  -f markdown-raw_tex  → strip embedded raw LaTeX, matching the PDF path.
            pandocArgs = [
                inputFile,
                '-o', outputFile,
                '-f', 'markdown-raw_tex',
                '-t', 'epub',
                '--number-sections',
                '--toc',
                '--toc-depth=2',
            ];

            // Only supply a fallback title when the document defines none, so a
            // user's frontmatter title is never overridden.
            if (!frontmatterHasTitle(markdownContent)) {
                pandocArgs.push('--metadata', `title=${deriveTitle(markdownContent)}`);
            }
        } else {
            const geometryOption = orientation === 'landscape' ? 'a4paper,landscape' : 'a4paper';

            // Pandoc args:
            //  -f markdown-raw_tex  → strip embedded raw LaTeX so user markdown can't
            //                         reach LuaLaTeX with \input{}, \directlua{}, etc.
            pandocArgs = [
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
        }

        const contentType = outputFormat === 'epub' ? 'application/epub+zip' : 'application/pdf';

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

            res.setHeader('Content-Type', contentType);
            const timestamp = Math.floor(Date.now() / 1000);
            res.setHeader('Content-Disposition', `attachment; filename="markdown${timestamp}.${outputFormat}"`);

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
