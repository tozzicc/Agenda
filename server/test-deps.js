import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const SECRET = 'test_secret';
const PASS = 'password123';

try {
    console.log('Testing Bcrypt...');
    const hash = bcrypt.hashSync(PASS, 10);
    console.log('Hash generated:', hash);
    const valid = bcrypt.compareSync(PASS, hash);
    console.log('Comparison valid:', valid);

    console.log('Testing JWT...');
    const token = jwt.sign({ id: 1, name: 'Test' }, SECRET, { expiresIn: '1h' });
    console.log('Token generated:', token);
    const decoded = jwt.verify(token, SECRET);
    console.log('Token decoded:', decoded.name === 'Test');

    console.log('SUCCESS: All libraries working correctly.');
} catch (err) {
    console.error('FAILURE:', err);
}
