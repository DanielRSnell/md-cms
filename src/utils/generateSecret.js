import crypto from 'crypto';

const generateSecret = () => {
  return crypto.randomBytes(32).toString('hex');
};

console.log('Generated Session Secret:', generateSecret());
