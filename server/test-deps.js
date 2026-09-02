import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const secret = crypto.randomBytes(32).toString('hex');
const password = crypto.randomBytes(16).toString('hex');

try {
    console.log('Testing Bcrypt...');
    const hash = bcrypt.hashSync(password, 10);
    console.log('Hash generated:', hash);
    const valid = bcrypt.compareSync(password, hash);
    console.log('Comparison valid:', valid);

    console.log('Testing JWT...');
    const token = jwt.sign({ id: 1, name: 'Test' }, secret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, secret);
    console.log('Token decoded:', decoded.name === 'Test');

    console.log('SUCCESS: All libraries working correctly.');
} catch (err) {
    console.error('FAILURE:', err);
}
