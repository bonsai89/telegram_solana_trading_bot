const fs = require('fs');
const path = require('path');

// Create writable streams to log files
const logStream = fs.createWriteStream(path.join(__dirname, 'console.log'), { flags: 'a' });
const errorStream = fs.createWriteStream(path.join(__dirname, 'console-error.log'), { flags: 'a' });

// Preserve original console functions
const originalConsole = {
    log: console.log,
    error: console.error
};

// Function to strip ANSI escape codes
function stripAnsi(text) {
    return String(text).replace(/\u001b\[\d+m/g, ''); // Replace ANSI escape codes with empty string
}

// Format the message
function formatMessage(type, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => typeof arg === 'string' ? stripAnsi(arg) : arg).join(' ');
    return `${timestamp} [${type}] ${message}\n`;
}

// Override console.log with custom logging function
console.log = function(...args) {
    const formattedMessage = formatMessage('INFO', args);
    process.stdout.write(formattedMessage); // Print to screen
    logStream.write(formattedMessage); // Write to log file
    originalConsole.log.apply(console, args); // Call original console.log
};

// Override console.error with custom logging function
console.error = function(...args) {
    const formattedMessage = formatMessage('ERROR', args);
    process.stderr.write(formattedMessage); // Print to screen
    errorStream.write(formattedMessage); // Write to error file
    logStream.write(formattedMessage);
    originalConsole.error.apply(console, args); // Call original console.error
};

// Ensure streams are closed on process exit
process.on('exit', () => {
    logStream.end();
    errorStream.end();
});

module.exports = {
    originalConsole // Optionally expose original console functions for direct use if needed
};
