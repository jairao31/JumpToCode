// open-in-editor-server.js
import express from "express";
import cors from "cors";
import { exec } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable CORS for localhost
app.use(cors({
	origin: /^http:\/\/localhost:\d+$/,
	methods: ['POST', 'OPTIONS']
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
	res.json({ status: 'ok', message: 'JumpToCode helper server is running' });
});

app.post("/open", (req, res) => {
	const { file, line } = req.body;

	if (!file) {
		console.error("❌ Missing file path in request");
		return res.status(400).send("Missing file path");
	}

	console.log(`📥 Received request: ${file}:${line || '1'}`);

	// Handle different path formats
	let absolutePath = file;

	// Remove webpack:// or similar prefixes
	absolutePath = absolutePath.replace(/^webpack:\/\/\//, '');
	absolutePath = absolutePath.replace(/^webpack:\/\//, '');

	// Remove leading ./
	absolutePath = absolutePath.replace(/^\.\//, '');

	// If path starts with /Users (macOS absolute path), use it directly
	if (absolutePath.startsWith('/Users/') || absolutePath.startsWith('/home/') || /^[A-Z]:\\/.test(absolutePath)) {
		absolutePath = path.resolve(absolutePath);
		console.log(`🔍 Using absolute path: ${absolutePath}`);
	}
	// If it's not absolute, try to resolve it
	else if (!path.isAbsolute(absolutePath)) {
		// Try project root (where server is running)
		absolutePath = path.join(process.cwd(), absolutePath);
		console.log(`🔍 Resolved relative path: ${absolutePath}`);
	}

	console.log(`🔍 Resolved path: ${absolutePath}`);

	// Check if file exists
	if (!fs.existsSync(absolutePath)) {
		// Try common source directories
		const commonPaths = [
			path.join(process.cwd(), 'src', path.basename(absolutePath)),
			path.join(process.cwd(), 'app', path.basename(absolutePath)),
			path.join(process.cwd(), 'components', path.basename(absolutePath)),
		];

		let found = false;
		for (const tryPath of commonPaths) {
			if (fs.existsSync(tryPath)) {
				absolutePath = tryPath;
				found = true;
				console.log(`✅ Found file at: ${absolutePath}`);
				break;
			}
		}

		if (!found) {
			console.error(`❌ File not found: ${absolutePath}`);
			console.error(`   Original path: ${file}`);
			return res.status(404).send(`File not found: ${absolutePath}`);
		}
	} else {
		console.log(`✅ File exists: ${absolutePath}`);
	}

	const lineArg = line ? `:${line}` : '';
	const command = `code --reuse-window --goto "${absolutePath}${lineArg}"`;

	console.log(`🚀 Executing: ${command}`);

	exec(command, (err, stdout, stderr) => {
		if (err) {
			console.error("❌ Error opening file:", err.message);
			if (stderr) console.error("   stderr:", stderr);
			return res.status(500).send(`Failed to open file in VS Code: ${err.message}`);
		}

		console.log("✅ File opened successfully in VS Code");
		if (stdout) console.log("   stdout:", stdout);

		res.json({
			success: true,
			message: "File opened successfully",
			file: absolutePath,
			line: line || 1
		});
	});
});

const PORT = 5123;
app.listen(PORT, () => {
	console.log(`🚀 JumpToCode helper server running on http://localhost:${PORT}`);
	console.log(`📂 Working directory: ${process.cwd()}`);
	console.log(`💡 Make sure VS Code 'code' command is in your PATH`);
});

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('\n👋 Shutting down JumpToCode helper server...');
	process.exit(0);
});