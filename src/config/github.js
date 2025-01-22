import axios from 'axios';

export const githubConfig = {
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  baseUrl: process.env.BASE_URL,
  authorizationURL: 'https://github.com/login/oauth/authorize',
  tokenURL: 'https://github.com/login/oauth/access_token',
  callbackURL: `${process.env.BASE_URL}/github/auth/callback`,
  scope: ['repo', 'read:user', 'user:email'].join(' '),
  getAuthorizationUrl: (state) => {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: `${process.env.BASE_URL}/github/auth/callback`,
      scope: ['repo', 'read:user', 'user:email'].join(' '),
      state: state
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }
};

export const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Accept: 'application/vnd.github.v3+json'
  }
});
