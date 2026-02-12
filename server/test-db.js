import db from './db.js';

console.log('Running DB Diagnostics...');

db.serialize(() => {
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
        if (err) {
            console.error('DIAGNOSTIC ERROR (Checking tables):', err.message);
        } else if (row) {
            console.log('SUCCESS: Table "users" exists.');
        } else {
            console.log('FAILURE: Table "users" DOES NOT exist.');
        }
    });

    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'", (err, row) => {
        if (err) {
            console.error('DIAGNOSTIC ERROR (Checking tables):', err.message);
        } else if (row) {
            console.log('SUCCESS: Table "appointments" exists.');
        } else {
            console.log('FAILURE: Table "appointments" DOES NOT exist.');
        }
    });
});

setTimeout(() => {
    db.close();
    console.log('Diagnostics complete.');
}, 2000);
