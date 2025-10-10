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
	methods: ['POST', 'GET', 'OPTIONS']
}));

app.use(express.json());

// Check if VS Code is installed
async function checkVSCodeInstalled() {
	return new Promise((resolve) => {
		const isWindows = process.platform === 'win32';
		const checkCmd = isWindows ? 'where code' : 'which code';

		exec(checkCmd, (err, stdout) => {
			if (err || !stdout) {
				resolve(false);
			} else {
				resolve(true);
			}
		});
	});
}

// Health check endpoint
app.get('/health', (req, res) => {
	res.json({
		status: 'ok',
		message: 'JumpToCode helper server is running',
		version: '2.1.0'
	});
});

// Open file endpoint
app.post("/open", async (req, res) => {
	const { file, line } = req.body;

	if (!file) {
		console.error("❌ Missing file path in request");
		return res.status(400).json({
			error: "Missing file path",
			alertUser: true
		});
	}

	console.log(`📥 Received request: ${file}:${line || '1'}`);

	// Resolve file path
	let absolutePath = resolvePath(file);

	if (!fs.existsSync(absolutePath)) {
		absolutePath = findFileInCommonPaths(absolutePath);
		if (!absolutePath) {
			console.error(`❌ File not found: ${file}`);
			return res.status(404).json({
				error: "File not found",
				file: file,
				alertUser: true,
				alertMessage: `File not found: ${file}`
			});
		}
	}

	console.log(`✅ File exists: ${absolutePath}`);

	// Check if VS Code is installed
	const vscodeInstalled = await checkVSCodeInstalled();

	if (!vscodeInstalled) {
		console.warn("⚠️  VS Code 'code' command not found in PATH");
		return res.status(503).json({
			error: "VS Code not installed or 'code' command not in PATH",
			vscodeNotInstalled: true,
			file: absolutePath,
			line: line || 1,
			alertUser: true,
			alertMessage: `VS Code not found!\n\nFile: ${absolutePath}\nLine: ${line || 1}\n\nPlease install VS Code or add 'code' command to your PATH.`
		});
	}

	const command = `code --reuse-window --goto "${absolutePath}:${line || 1}"`;

	console.log(`🚀 Opening in VS Code`);
	console.log(`   File: ${absolutePath}`);
	console.log(`   Line: ${line || 1}`);
	console.log(`   Command: ${command}`);

	exec(command, (err, stdout, stderr) => {
		if (err) {
			console.error("❌ Error opening file:", err.message);
			if (stderr) console.error("   stderr:", stderr);

			return res.status(500).json({
				error: `Failed to open file in VS Code`,
				details: err.message,
				file: absolutePath,
				line: line || 1,
				alertUser: true,
				alertMessage: `Failed to open in VS Code\n\nFile: ${absolutePath}\nLine: ${line || 1}\n\nError: ${err.message}`
			});
		}

		console.log("✅ File opened successfully in VS Code");
		if (stdout) console.log("   stdout:", stdout);

		res.json({
			success: true,
			message: "File opened successfully",
			editor: "VS Code",
			file: absolutePath,
			line: line || 1
		});
	});
});

// Helper functions
function resolvePath(file) {
	let absolutePath = file;

	// Remove webpack:// or similar prefixes
	absolutePath = absolutePath.replace(/^webpack:\/\/\//, '');
	absolutePath = absolutePath.replace(/^webpack:\/\//, '');
	absolutePath = absolutePath.replace(/^\.\//, '');

	// If already absolute, use it
	if (absolutePath.startsWith('/Users/') ||
		absolutePath.startsWith('/home/') ||
		/^[A-Z]:\\/.test(absolutePath)) {
		return path.resolve(absolutePath);
	}

	// Resolve relative to cwd
	return path.join(process.cwd(), absolutePath);
}

function findFileInCommonPaths(absolutePath) {
	const commonPaths = [
		path.join(process.cwd(), 'src', path.basename(absolutePath)),
		path.join(process.cwd(), 'app', path.basename(absolutePath)),
		path.join(process.cwd(), 'components', path.basename(absolutePath)),
		path.join(process.cwd(), 'pages', path.basename(absolutePath)),
	];

	for (const tryPath of commonPaths) {
		if (fs.existsSync(tryPath)) {
			console.log(`✅ Found file at: ${tryPath}`);
			return tryPath;
		}
	}

	return null;
}

const PORT = 5123;
app.listen(PORT, async () => {
	console.log(`🚀 JumpToCode helper server v2.1 running on http://localhost:${PORT}`);
	console.log(`📂 Working directory: ${process.cwd()}`);

	const vscodeInstalled = await checkVSCodeInstalled();
	if (vscodeInstalled) {
		console.log(`✅ VS Code detected and ready`);
	} else {
		console.warn(`⚠️  VS Code 'code' command not found in PATH`);
		console.warn(`   Install VS Code or add 'code' command to PATH`);
		console.warn(`   The extension will show file location if VS Code is not available`);
	}

	console.log(`\n💡 Tip: Make sure VS Code 'code' command is in your PATH\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('\n👋 Shutting down JumpToCode helper server...');
	process.exit(0);
});