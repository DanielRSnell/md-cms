import axios from 'axios';

export const githubConfig = {
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  baseUrl: process.env.BASE_URL,
  authorizationURL: 'https://github.com/login/oauth/authorize',
  tokenURL: 'https://github.com/login/oauth/access_token',
  callbackURL: `${process.env.BASE_URL}/github/auth/callback`,
  scope: ['repo', 'read:user', 'user:email'].join(' ')
};

export const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Accept: 'application/vnd.github.v3+json'
  }
});

export function getAuthorizationUrl(state) {
  const params = new URLSearchParams({
    client_id: githubConfig.clientId,
    redirect_uri: githubConfig.callbackURL,
    scope: githubConfig.scope,
    state: state
  });

  return `${githubConfig.authorizationURL}?${params.toString()}`;
}
