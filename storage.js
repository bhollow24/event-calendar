// GitHub-backed storage for events data
// Allows permanent edits, additions, and deletions

const GITHUB_CONFIG = {
    owner: 'bhollow24',
    repo: 'event-calendar',
    branch: 'main',
    filePath: 'events.json',
    get token() {
        // Retrieve token from localStorage
        return localStorage.getItem('github_token') || null;
    }
};

let eventsSha = null; // Track file SHA for updates

// Check if GitHub token is configured
function hasGitHubToken() {
    return !!GITHUB_CONFIG.token;
}

// Prompt user to configure GitHub token if missing
function promptForGitHubToken() {
    const token = prompt(
        'To enable permanent saves, enter your GitHub Personal Access Token:\n\n' +
        '(Token needs repo access. Create at: https://github.com/settings/tokens)\n\n' +
        'Leave blank to skip (changes will only save locally until page refresh)'
    );
    
    if (token && token.trim()) {
        localStorage.setItem('github_token', token.trim());
        return true;
    }
    return false;
}

async function loadEventsFromGitHub() {
    // Don't try to load if no token configured
    if (!hasGitHubToken()) {
        console.log('No GitHub token - using default events from events-data.js');
        return null; // Signal to use default
    }

    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.filePath}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            eventsSha = data.sha;
            const content = atob(data.content);
            return JSON.parse(content);
        } else if (response.status === 404) {
            // File doesn't exist yet, will be created on first save
            console.log('events.json not found on GitHub - will be created on first save');
            return null; // Use default from events-data.js
        } else {
            console.error('Failed to load events from GitHub:', response.status);
            return null; // Fall back to default
        }
    } catch (error) {
        console.error('Error loading events from GitHub:', error);
        return null; // Fall back to default
    }
}

async function saveEventsToGitHub(eventsData) {
    // Safeguard: never save empty events array
    if (!eventsData || eventsData.length === 0) {
        console.error('Attempted to save empty events array - blocked for safety');
        alert('⚠️ Error: Cannot save empty events list. This is likely a bug.');
        return false;
    }

    // Check if token is configured
    if (!hasGitHubToken()) {
        const configured = promptForGitHubToken();
        if (!configured) {
            console.warn('No GitHub token - changes not persisted');
            return false;
        }
    }

    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.filePath}`;
        const content = btoa(JSON.stringify(eventsData, null, 2));
        
        const body = {
            message: `Update events data - ${new Date().toISOString()}`,
            content: content,
            branch: GITHUB_CONFIG.branch
        };

        if (eventsSha) {
            body.sha = eventsSha;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            const data = await response.json();
            eventsSha = data.content.sha;
            return true;
        } else {
            console.error('Failed to save events to GitHub:', response.status);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return false;
        }
    } catch (error) {
        console.error('Error saving events to GitHub:', error);
        return false;
    }
}

// Initialize: load events from GitHub on page load
async function initializeStorage() {
    const loadedEvents = await loadEventsFromGitHub();
    
    // Only replace events if we successfully loaded from GitHub AND it has events
    if (loadedEvents && loadedEvents.length > 0) {
        console.log(`Loaded ${loadedEvents.length} events from GitHub`);
        events.length = 0;
        events.push(...loadedEvents);
        
        // Re-render calendar with loaded data
        renderCalendar();
    } else {
        // Safeguard: ensure we have events from events-data.js
        if (events.length === 0) {
            console.error('No events loaded! This should not happen.');
            alert('⚠️ Error: No events loaded. Please refresh the page.');
            return;
        }
        console.log(`Using ${events.length} default events from events-data.js`);
        // Events already loaded from events-data.js, just render
        renderCalendar();
    }
}
