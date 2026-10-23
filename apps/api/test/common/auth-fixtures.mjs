export const AuthTestOrigin = 'https://flowboard.test';
export const AuthTestSecret = 'test-only-abcdefghijklmnopqrstuvwxyz123456';
export const SignupFixture = {
  email: 'new@example.com',
  name: 'New User',
  password: 'A secure password!',
  workspaceName: 'Personal work',
};
export const cookieOf = (response) => response.headers['set-cookie'][0].split(';')[0];
export const claimsOf = (token) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
