/**
 * Email service — supports console mode (logs to stdout) and SMTP.
 * Console mode is default for lab environments without mail infrastructure.
 */

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
}

class EmailService {
  private mode: string;

  constructor() {
    this.mode = process.env.EMAIL_MODE || 'console';
  }

  async send(options: EmailOptions): Promise<void> {
    if (this.mode === 'console') {
      console.log('[email] ─── outbound email ───');
      console.log(`  To:      ${options.to}`);
      console.log(`  Subject: ${options.subject}`);
      console.log(`  Body:    ${options.body}`);
      console.log('[email] ─── end ───');
      return;
    }

    // SMTP mode — requires nodemailer or similar
    // Placeholder for Phase 12+ if SMTP is configured
    console.warn('[email] SMTP mode not yet implemented — falling back to console');
    this.mode = 'console';
    await this.send(options);
  }

  /** Send a password reset link. */
  async sendPasswordReset(email: string, resetToken: string): Promise<void> {
    const portalOrigin = process.env.PORTAL_ORIGIN || 'http://172.16.0.10:3000';
    const resetUrl = `${portalOrigin}/reset-password?token=${resetToken}`;

    await this.send({
      to: email,
      subject: 'Lab Portal — Password Reset',
      body: `You requested a password reset.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour.\nIf you did not request this, ignore this email.`,
    });
  }
}

export const emailService = new EmailService();
