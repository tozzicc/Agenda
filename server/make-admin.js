import db from './db.js';

const email = process.argv[2];

if (!email) {
    console.error('Uso: node server/make-admin.js seu@email.com');
    process.exit(1);
}

db.run("UPDATE users SET role = 'admin' WHERE email = ?", [email], function (err) {
    if (err) {
        console.error('Erro ao atualizar:', err.message);
    } else if (this.changes === 0) {
        console.error('Usuário não encontrado:', email);
    } else {
        console.log(`Sucesso: O usuário ${email} agora é ADMINISTRADOR.`);
    }
});
