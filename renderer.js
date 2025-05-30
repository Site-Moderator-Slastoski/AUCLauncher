const { ipcRenderer } = require('electron');

// Install Button Click Handler
document.addEventListener('DOMContentLoaded', async () => {
    const selectedRegion = localStorage.getItem('selectedRegion');
    
    if (selectedRegion) {
        // Set the install button to use the correct method based on region
        document.getElementById('installButton').addEventListener('click', async () => {
            const installMethod = selectedRegion === 'europe' ? 'installGameEU' : 'installGameSA';
            console.log(`${installMethod} method selected for installation.`);

            // Hide install button and show "Installing" text
            const installButton = document.getElementById('installButton');
            const launchButton = document.getElementById('launchButton');
            const progressContainer = document.getElementById('progressContainer');

            installButton.innerText = 'Installing...';
            installButton.disabled = true;
            launchButton.style.display = 'none';
            progressContainer.style.display = 'block';

            const success = await ipcRenderer.invoke(installMethod);
            if (success) {
                console.log('Installation complete.');
                installButton.style.display = 'none';
                launchButton.style.display = 'block';
            } else {
                console.log('Installation failed.');
                alert('Installation failed. Please try again.');
            }
        });
    } else {
        console.log('No region selected. Defaulting to Europe.');
        // Default to Europe if no region is selected
        document.getElementById('installButton').addEventListener('click', async () => {
            const success = await ipcRenderer.invoke('installGameEU');
            if (success) {
                console.log('Installation complete.');
                document.getElementById('installButton').style.display = 'none';
                document.getElementById('launchButton').style.display = 'block';
            } else {
                alert('Installation failed. Please try again.');
            }
        });
    }
});

// Launch Button Click Handler
document.getElementById('launchButton').addEventListener('click', async () => {
    await ipcRenderer.invoke('launchGame');
});

// Progress Update Event Handler
ipcRenderer.on('gameProgress', (event, progress) => {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = `${progress}%`;
    progressBar.innerText = `${progress}%`;

    if (progress === 100) {
        setTimeout(() => {
            progressBar.style.display = 'none';
        }, 500);
    } else if (progress === -1) {
        alert('An error occurred during the installation. Please try again.');
    }
});

// Button State Update Handler
ipcRenderer.on('updateButton', (event, buttonState) => {    
    const button = document.getElementById('installButton');
    button.innerText = buttonState;

    if (buttonState === 'Launch') {
        button.onclick = () => ipcRenderer.invoke('launchGame');
    } else if (buttonState === 'Launched') {
        button.onclick = null; 
    } else {
        button.onclick = () => ipcRenderer.invoke('installGame');
    }
});

// Minimize Window Handler
document.getElementById('minimizeBtn').addEventListener('click', () => {
    ipcRenderer.send('minimizeWindow');
});

// Close Window Handler
document.getElementById('closeBtn').addEventListener('click', () => {
    ipcRenderer.send('closeWindow');
});
