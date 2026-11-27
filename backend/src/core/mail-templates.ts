import type { Mail } from './mail.service.js'

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const ROLE_NAMES: Record<string, string> = { gerente: 'Gerente', vendedor: 'Vendedor' }

const layout = (title: string, body: string, cta: { href: string; label: string }, foot: string) => `<!DOCTYPE html>
<html lang="es"><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <tr><td>
      <p style="margin:0 0 24px;font-size:20px;font-weight:bold;color:#4f46e5">Vendex</p>
      <h1 style="margin:0 0 16px;font-size:20px">${esc(title)}</h1>
      ${body}
      <p style="margin:28px 0"><a href="${esc(cta.href)}" style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold;display:inline-block">${esc(cta.label)}</a></p>
      <p style="margin:0 0 8px;font-size:12px;color:#64748b">Si el botón no funciona, copia este enlace en tu navegador:</p>
      <p style="margin:0 0 24px;font-size:12px;word-break:break-all"><a href="${esc(cta.href)}" style="color:#4f46e5">${esc(cta.href)}</a></p>
      <p style="margin:0;font-size:12px;color:#64748b">${esc(foot)}</p>
    </td></tr>
  </table>
</body></html>`

export const inviteLink = (appUrl: string, token: string) => `${appUrl}/registro?token=${encodeURIComponent(token)}`
export const resetLink = (appUrl: string, token: string) => `${appUrl}/restablecer-clave?token=${encodeURIComponent(token)}`

export function invitationMail(p: { to: string; appUrl: string; token: string; companyName: string; role: string; invitedBy: string | null; expiresAt: string }): Mail {
  const link = inviteLink(p.appUrl, p.token)
  const role = ROLE_NAMES[p.role] ?? p.role
  const who = p.invitedBy ? `${p.invitedBy} te invitó` : 'Te invitaron'
  const until = new Date(p.expiresAt).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
  return {
    to: p.to,
    subject: `Te invitaron a ${p.companyName} en Vendex`,
    html: layout(
      `Únete a ${p.companyName}`,
      `<p style="margin:0 0 12px;line-height:1.5">${esc(who)} a unirte a <b>${esc(p.companyName)}</b> en Vendex como <b>${esc(role)}</b>.</p>
       <p style="margin:0;line-height:1.5">Crea tu contraseña para activar tu cuenta. La invitación vence el ${esc(until)}.</p>`,
      { href: link, label: 'Activar mi cuenta' },
      'Si no esperabas esta invitación, ignora este correo.',
    ),
    text: `${who} a unirte a ${p.companyName} en Vendex como ${role}.\n\nActiva tu cuenta aquí (vence el ${until}):\n${link}\n\nSi no esperabas esta invitación, ignora este correo.`,
  }
}

export function passwordResetMail(p: { to: string; appUrl: string; token: string; name: string }): Mail {
  const link = resetLink(p.appUrl, p.token)
  return {
    to: p.to,
    subject: 'Restablece tu contraseña de Vendex',
    html: layout(
      'Restablece tu contraseña',
      `<p style="margin:0 0 12px;line-height:1.5">Hola ${esc(p.name)}, recibimos una solicitud para cambiar tu contraseña.</p>
       <p style="margin:0;line-height:1.5">El enlace funciona una sola vez y vence en <b>1 hora</b>.</p>`,
      { href: link, label: 'Crear nueva contraseña' },
      'Si no pediste el cambio, ignora este correo: tu contraseña actual sigue siendo válida.',
    ),
    text: `Hola ${p.name}, recibimos una solicitud para cambiar tu contraseña de Vendex.\n\nCrea una nueva aquí (vence en 1 hora, un solo uso):\n${link}\n\nSi no pediste el cambio, ignora este correo.`,
  }
}
