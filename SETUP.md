# Event Calendar Setup

## GitHub Token Configuration

To enable permanent event saves (persist across browser sessions), you need to configure a GitHub Personal Access Token.

### Option 1: Settings UI (Recommended)

1. Visit https://bhollow24.github.io/event-calendar/
2. Click the "⚙️ Settings" button in the top-right
3. Enter your GitHub Personal Access Token (with `repo` scope)
4. Click "Save Token"

### Option 2: Browser Console Setup

Open your browser console on the Event Calendar page and run:

```javascript
localStorage.setItem('github_token', 'YOUR_GITHUB_TOKEN_HERE');
location.reload();
```

### Option 3: Prompt-Based Setup

When you first try to add, edit, or delete an event without a configured token, you'll be prompted to enter it.

### Creating a GitHub Token

1. Go to https://github.com/settings/tokens/new
2. Give it a descriptive name (e.g., "Event Calendar")
3. Select `repo` scope
4. Generate and copy the token

### How It Works

- **With token**: Changes save permanently to GitHub (events.json file)
- **Without token**: Changes only persist in current browser session (lost on refresh)

### Clearing the Token

Use the Settings UI "Clear Token" button, or via console:

```javascript
localStorage.removeItem('github_token');
```

---

**Note:** The token is stored in your browser's localStorage. It's never transmitted except to GitHub API for saving events.
