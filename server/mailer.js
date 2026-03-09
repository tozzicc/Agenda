import nodemailer from 'nodemailer';

/**
 * Configure your SMTP settings here or via environment variables.
 * For Gmail:
 * - Host: smtp.gmail.com
 * - Port: 587
 * - User: your-email@gmail.com
 * - Pass: your-app-password (not your regular password)
 */

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER?.trim(),
        pass: process.env.SMTP_PASS?.trim(),
    },
});

export const sendPasswordResetEmail = async (to, resetLink) => {
    const mailOptions = {
        from: `"Agenda" <${process.env.SMTP_USER}>`,
        to: to,
        subject: 'Recuperação de Senha - Agenda',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
                <h2 style="color: #4f46e5; text-align: center;">Recuperação de Senha</h2>
                <p>Olá,</p>
                <p>Você solicitou a redefinição de sua senha. Clique no botão abaixo para criar uma nova senha:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Redefinir Minha Senha</a>
                </div>
                <p style="color: #64748b; font-size: 14px;">Se você não solicitou isso, pode ignorar este e-mail com segurança.</p>
                <p style="color: #64748b; font-size: 14px;">Este link expirará em 1 hora.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} Agenda. Todos os direitos reservados.</p>
            </div>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
        return info;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};
export const sendBookingConfirmationEmail = async (to, bookingDetails) => {
    const { name, date, time, phone, notes } = bookingDetails;

    // Format date for display (assuming YYYY-MM-DD)
    const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');

    const mailOptions = {
        from: `"Agenda" <${process.env.SMTP_USER}>`,
        to: to,
        subject: 'Confirmação de Agendamento - Agenda',
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #4f46e5; text-align: center;">Agendamento Confirmado!</h2>
                <p>Olá <strong>${name}</strong>,</p>
                <p>Seu agendamento foi realizado com sucesso. Confira os detalhes abaixo:</p>
                
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Data:</strong> ${formattedDate}</p>
                    <p style="margin: 5px 0;"><strong>Horário:</strong> ${time}</p>
                    <p style="margin: 5px 0;"><strong>Telefone:</strong> ${phone}</p>
                    ${notes ? `<p style="margin: 5px 0;"><strong>Observações:</strong> ${notes}</p>` : ''}
                </div>

                <p style="color: #64748b; font-size: 14px;">Se precisar cancelar ou alterar o horário, acesse sua conta no sistema.</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} Agenda. Todos os direitos reservados.</p>
            </div>
        `,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Booking confirmation email sent: ' + info.response);
        return info;
    } catch (error) {
        console.error('Error sending booking confirmation email:', error);
        throw error;
    }
};
