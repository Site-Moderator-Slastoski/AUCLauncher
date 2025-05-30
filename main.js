const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const extract = require('extract-zip');
const { exec } = require('child_process');

let mainWindow;
const datFilePath = path.join(os.homedir(), 'AppData', 'LocalLow', 'Innersloth', 'Among Us', 'regionInfo.dat');
const appPath = path.join(os.homedir(), 'AppData', 'Roaming', 'AmongUsClassic', 'SmartSteamLoader_x64.exe');
const tokenCachePath = path.join(os.homedir(), 'AppData', 'Roaming', 'AmongUsClassic', 'token-cache.json');

// Function to check if the cached token is still valid
function isTokenValid(cachedToken) {
    const currentTime = Date.now();
    const tokenExpiryTime = cachedToken.timestamp + (24 * 60 * 60 * 1000); // 24 hours expiry
    return currentTime < tokenExpiryTime && cachedToken.downloads < 3; // Token is valid if it's within 24 hours and less than 3 downloads
}

// Function to get the cached token or request a new one
async function getToken(url) {
    try {
        // Try to load the cached token
        if (fs.existsSync(tokenCachePath)) {
            const cachedToken = JSON.parse(fs.readFileSync(tokenCachePath, 'utf8'));
            if (isTokenValid(cachedToken)) {
                console.log('Reusing cached token');
                return cachedToken.token;
            } else {
                console.log('Cached token is invalid or expired');
            }
        }

        // Request a new token if the cached one is invalid or expired
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url, {
            method: 'POST',
        });

        if (!response.ok) {
            if (response.status === 429) {
                console.log('Rate limit exceeded, retrying in 1 hour...');
                await delay(3600000); // Wait for 1 hour before retrying
                return getToken(url); // Retry after waiting
            } else {
                throw new Error(`Failed to request token: ${response.statusText}`);
            }
        }

        const data = await response.json();
        console.log('Token received:', data.token);

        const newToken = {
            token: data.token,
            timestamp: Date.now(),
            downloads: 0 // Track number of downloads
        };

        // Save the new token to cache
        fs.writeFileSync(tokenCachePath, JSON.stringify(newToken), 'utf8');
        return data.token;
    } catch (error) {
        console.error('Error getting token:', error);
        throw error;
    }
}

// Function to wait for a specified time (milliseconds)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to download the file using the token
async function downloadFileSA(url, dest, token) {
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url, {
            headers: {
                'Authorization': token
            }
        });

        if (response.status === 401) {
            console.error('Unauthorized. The token may be invalid or expired.');
            // Request a new token if the current one is invalid
            return downloadFileSA(url, dest, await getToken('http://152.70.212.248/auc-key')); // Retry with a new token
        }

        if (!response.ok) {
            throw new Error(`Failed to download file: ${response.statusText}`);
        }

        const fileStream = fs.createWriteStream(dest);
        response.body.pipe(fileStream);
        return new Promise((resolve, reject) => {
            fileStream.on('finish', resolve);
            fileStream.on('error', reject);
        });
    } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
    }
}

async function downloadFileEU(url, dest) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Unexpected response ${response.statusText}`);
        }

        await streamPipeline(response.body, fs.createWriteStream(dest));
        console.log(`File downloaded successfully to ${dest}`);
    } catch (error) {
        console.error(`Error downloading file: ${error.message}`);
    }
}

// Function to extract the downloaded ZIP file
async function extractZip(filePath, outputDir) {
    try {
        console.log(`Extracting ${filePath} to ${outputDir}`);
        await extract(filePath, { dir: outputDir });
        console.log('Extraction complete.');
        mainWindow.webContents.send('gameProgress', 100);
    } catch (err) {
        console.error('Error during extraction:', err);
        mainWindow.webContents.send('gameProgress', -1);
    }
}

// Ensure that a directory exists
function ensureDirectoryExistence(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

// Check the installation state of the game and update button
async function checkAndUpdateButton() {
    const isGameInstalled = fs.existsSync(appPath);
    const isDatInstalled = fs.existsSync(datFilePath);

    if (isGameInstalled && isDatInstalled) {
        mainWindow.webContents.send('updateButton', 'Launch');
    } else {
        mainWindow.webContents.send('updateButton', 'Install');
    }
}

ipcMain.handle('installGameSA', async () => {
    const tokenUrl = 'http://152.70.212.248/auc-key';
    const fileUrl = 'http://152.70.212.248/files/au.zip';
    const datUrl = 'http://152.70.212.248/files/regionInfo.dat';
    const zipFilePath = path.join(os.homedir(), 'AppData', 'Roaming', 'AmongUsClassic', 'installer.zip');

    try {
        ensureDirectoryExistence(path.dirname(zipFilePath));

        // Step 1: Request a new token before starting the download process
        const token = await getToken(tokenUrl);

        if (!token) {
            console.error('Failed to get a valid token');
            return false;
        }

        console.log('Token received:', token);

        // Step 2: Download the file using the token
        console.log('Starting file download...');
        await downloadFileSA(fileUrl, zipFilePath, token);

        ensureDirectoryExistence(path.dirname(datFilePath));
        await downloadFileSA(datUrl, datFilePath, token);

        // Step 3: Extract the zip file using extract-zip
        console.log('Download completed, extracting file...');
        await extractZip(zipFilePath, path.dirname(zipFilePath));

        // Step 4: Check button state
        console.log('Install completed, now checking button state...');
        await checkAndUpdateButton();

        // Step 5: Update the UI to show "Launch" button
        mainWindow.webContents.send('updateButton', 'Launch');
        return true;
    } catch (error) {
        console.error('Error during installation:', error);
        return false;
    }
});

ipcMain.handle('installGameEU', async () => {
    const EUFileURL = 'https://example.com/installer.zip';
    const EUDatURL = 'https://example.com/config.dat';
    
    const zipFilePath = path.join(os.homedir(), 'AppData', 'Roaming', 'AmongUsClassic', 'installer.zip');
    const datFilePath = path.join(os.homedir(), 'AppData', 'Roaming', 'AmongUsClassic', 'config.dat');

    try {
        ensureDirectoryExistence(path.dirname(zipFilePath));
        console.log('Starting file download...');

        await downloadFileEU(EUFileURL, zipFilePath);

        ensureDirectoryExistence(path.dirname(datFilePath));
        await downloadFileEU(EUDatURL, datFilePath);

        console.log('Download completed, extracting the file...');
        await extractZip(zipFilePath, path.dirname(zipFilePath));

        console.log('Install completed, now checking button state...');
        await checkAndUpdateButton();

        mainWindow.webContents.send('updateButton', 'Launch');
        return true;

    } catch (error) {
        console.error('Installation failed:', error);
    }
});


ipcMain.handle('launchGame', () => {
    try {
        exec(`start "" "${appPath}"`, (err, stdout, stderr) => {
            if (err) {
                console.error('Error launching game:', err);
                return;
            }
            console.log('Game launched successfully');
        });
    } catch (error) {
        console.error('Error during launch:', error);
    }
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 350,
        frame: false,
        resizable: false,
        title: "Among Us Classic Installer",
        backgroundColor: "#0a0a2a",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    ipcMain.on('minimizeWindow', () => {
        mainWindow.minimize();
    });

    ipcMain.on('closeWindow', () => {
        mainWindow.close();
    });
}

app.whenReady().then(() => {
    createWindow();
    checkAndUpdateButton();  

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
