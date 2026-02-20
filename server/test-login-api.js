try {
    const response = await fetch('http://127.0.0.1:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@admin.com', password: 'admin123' }),
    });

    console.log('STATUS:', response.status);
    const data = await response.json();
    console.log('RESPONSE:', JSON.stringify(data, null, 2));
} catch (err) {
    console.error('FETCH_ERROR:', err);
}
