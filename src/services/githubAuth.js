import crypto from 'crypto';

class GitHubAuthService {
  constructor() {
    this.stateStore = new Map();
    this.setupStateCleanup();
  }

  setupStateCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [state, data] of this.stateStore.entries()) {
        if (now - data.timestamp > 1000 * 60 * 10) { // 10 minutes
          this.stateStore.delete(state);
        }
      }
    }, 1000 * 60); // Clean every minute
  }

  generateState(userId) {
    const state = crypto.randomBytes(32).toString('hex');
    this.stateStore.set(state, {
      userId,
      timestamp: Date.now()
    });
    return state;
  }

  validateState(state) {
    const data = this.stateStore.get(state);
    if (!data) return null;
    this.stateStore.delete(state);
    return data.userId;
  }

  async getAuthorizationUrl(userId) {
    const state = this.generateState(userId);
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: `${process.env.BASE_URL}/github/auth/callback`,
      scope: 'repo read:user user:email',
      state: state
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.BASE_URL}/github/auth/callback`
      })
    });

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('Failed to get access token');
    }

    return data.access_token;
  }

  async getGitHubUser(accessToken) {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Markdown-CMS'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const user = await response.json();
    if (!user || !user.id) {
      throw new Error('Invalid GitHub user data received');
    }

    return user;
  }
}

export const githubAuthService = new GitHubAuthService();
