import { Injectable, Logger } from '@nestjs/common'
import { AppConfig } from './app-config.js'

export interface Mail {
  to: string
  subject: string
  html: string
  text: string
}

/**
 * Envío de correos.
 * · MAIL_DRIVER=console (desarrollo): no envía nada; imprime el correo en el log y lo guarda en
 *   `outbox` (las pruebas e2e leen de ahí los enlaces).
 * · MAIL_DRIVER=resend: API HTTP de Resend (https://resend.com). Requiere RESEND_API_KEY y un
 *   MAIL_FROM con un dominio verificado en Resend.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail')
  readonly outbox: Mail[] = []

  constructor(private readonly config: AppConfig) {}

  async send(mail: Mail): Promise<void> {
    if (this.config.mailDriver === 'console') {
      this.outbox.push(mail)
      if (this.outbox.length > 50) this.outbox.shift()
      this.logger.log(`✉  Para: ${mail.to} · ${mail.subject}\n${mail.text}`)
      return
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.config.mailFrom, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }

  /** Envía sin bloquear la respuesta; los errores solo quedan en el log */
  sendInBackground(mail: Mail) {
    this.send(mail).catch((e: unknown) => this.logger.error(`No se pudo enviar "${mail.subject}" a ${mail.to}: ${(e as Error).message}`))
  }
}
