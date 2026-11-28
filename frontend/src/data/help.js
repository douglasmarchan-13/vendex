/**
 * Ayuda de cada módulo: qué es, cómo empezar en 3 pasos, qué hay en la pantalla y consejos.
 * Un elemento con `roles` solo se muestra a esos roles (p. ej. lo que solo hace el gerente).
 */
export const HELP = {
  hoy: {
    short: 'Hoy',
    title: 'Hoy · Mi Copiloto',
    intro: 'Es tu punto de partida cada mañana. Te dice qué hacer hoy, cómo vas con la meta del mes y qué clientes necesitan tu atención.',
    steps: [
      'Revisa las Alertas del Copiloto y usa el botón de cada una: llamar, enviar WhatsApp o registrar un pago.',
      'Trabaja tu Agenda del día y marca cada tarea con el check cuando la termines.',
      'Mira la barra de Meta del mes para saber cuánto te falta vender.',
    ],
    features: [
      { title: 'Meta del mes', text: 'Lo vendido este mes frente a la meta. Si eliges un país arriba, ves la meta de ese país.' },
      { title: 'Por cerrar', text: 'Suma de los tratos en cotización y en negociación. Toca la tarjeta para ir al Embudo.' },
      { title: 'Alertas del Copiloto', text: 'Avisos automáticos: tratos calientes, clientes olvidados, promesas que hiciste, cobros vencidos o por vencer. "Posponer" oculta la alerta por ahora.' },
      { title: 'Agenda del día', text: 'Llamadas, WhatsApp, reuniones y visitas de hoy. Con "+ Tarea" agendas una nueva para un cliente.' },
      { title: 'Próximos días', text: 'Las tareas de la próxima semana, para que te prepares.' },
      { title: 'Resumen de cobranza', text: 'Cuánto está vencido, cuánto vence hoy y cuánto en los próximos 7 días.' },
    ],
    tips: [
      'Atiende primero lo que está en rojo o ámbar: son tareas atrasadas o cobros vencidos.',
      'Si Vendex está abierto, te avisa 15 minutos antes de cada tarea. Permite las notificaciones del navegador para no perderte ninguna.',
    ],
  },

  embudo: {
    short: 'Embudo',
    title: 'Embudo de ventas',
    intro: 'Un tablero con todas tus oportunidades de venta (tratos) ordenadas por etapa. De un vistazo sabes qué está por cerrarse y qué se está enfriando.',
    steps: [
      'Crea un trato con "Nuevo trato" (arriba a la derecha o al pie de la columna Prospecto nuevo).',
      'Avanza la tarjeta cuando el cliente avance: arrástrala a otra columna o toca la flecha → para pasarla a la siguiente etapa.',
      'Al llevarla a "Venta cerrada", Vendex te pide definir cómo te van a pagar para avisarte de cada cobro.',
    ],
    features: [
      { title: 'Etapas', text: 'Prospecto nuevo → Contactado → Cotización enviada → En negociación → Venta cerrada. Cada columna muestra cuántos tratos hay y cuánto suman.' },
      { title: 'La tarjeta', text: 'Muestra el cliente, el producto, el monto, la temperatura (Caliente, Tibio o Frío) y la próxima acción. En rojo si está vencida, en azul si es hoy.' },
      { title: 'Mover a cualquier etapa', text: 'El ícono ⇄ de la tarjeta te deja elegir la etapa directamente, incluso "Por ahora no" para pausar el trato.' },
      { title: 'Por ahora no', text: 'Los tratos pausados quedan abajo del tablero. Desde ahí puedes "Reactivar" cualquiera.' },
      { title: 'Filtros', text: 'Busca por cliente, producto o ciudad y filtra por temperatura.' },
      { title: 'Filtro por vendedor', text: 'Elige un vendedor para ver solo sus tratos.', roles: ['gerente'] },
    ],
    tips: [
      'Toca el nombre del cliente en la tarjeta para abrir su ficha con todo el historial.',
      'Si te equivocas al mover una tarjeta, usa "Deshacer" en el aviso que aparece abajo.',
    ],
  },

  clientes: {
    short: 'Clientes',
    title: 'Clientes y prospectos',
    intro: 'Tu agenda de contactos. Aquí están todos los prospectos y clientes, con su último contacto y accesos rápidos para comunicarte con ellos.',
    steps: [
      'Busca a un contacto por nombre, empresa, ciudad, teléfono o RUC, o usa los filtros de arriba.',
      'Usa los botones de cada fila para escribirle por WhatsApp, llamarlo o registrar un correo.',
      'Toca la fila para abrir la ficha del cliente: tratos, pagos, cotizaciones e historial.',
    ],
    features: [
      { title: 'Filtros rápidos', text: '"Clientes activos" (ya compraron), "Prospectos calientes" y "Sin contacto +7 días" para recuperar a los que se están olvidando.' },
      { title: 'WhatsApp con plantillas', text: 'Elige una plantilla y se completa sola con el nombre, producto y monto. Puedes editarla, guardar las tuyas y abrirla directo en WhatsApp.' },
      { title: 'Registrar llamada', text: 'Elige qué pasó: "Interesado" lo marca como caliente, "Que lo llame luego" lo pospone 7 días, "No contesta" te propone un WhatsApp y "Por ahora no" pausa el trato.' },
      { title: 'Ficha del cliente', text: 'Datos de contacto, tratos, estado de cuenta, cotizaciones en PDF e historial. Con el lápiz editas o eliminas al cliente.' },
      { title: 'Historial de seguimiento', text: 'Anota lo que pasó en cada conversación (nota, llamada, WhatsApp o visita). Así nadie pierde el hilo.' },
      { title: 'Importar desde Excel', text: 'Trae tu hoja de clientes (.xlsx) tal como la tienes. Verás una vista previa y nada se guarda hasta que confirmes.' },
    ],
    tips: [
      'Adjunta la cotización en PDF en la ficha del cliente para tenerla a mano cuando te llame.',
      'Un cliente con ventas o cobros registrados no se puede eliminar, para no perder su historial.',
    ],
  },

  cobranza: {
    short: 'Cobranza',
    title: 'Cobranza',
    intro: 'Controla lo que te deben tus clientes: cuotas vencidas, las que vencen hoy y las que vienen. Vendex te avisa solo, a partir del plan de cobro de cada venta.',
    steps: [
      'Revisa las tarjetas de arriba: Vencido, Vence hoy, Próximos 7 días y Cobrado este mes. Tócalas para filtrar la lista.',
      'Usa "Recordar" para enviarle al cliente un WhatsApp con el monto y la fecha ya escritos.',
      'Cuando te paguen, toca "Registrar pago" e indica el monto, el método y la fecha.',
    ],
    features: [
      { title: 'Plan de cobro', text: 'Al cerrar una venta eliges cómo te pagarán: al contado, 50% + 50% o financiado con inicial y cuotas mensuales. Vendex crea las cuotas.' },
      { title: 'Ventas sin plan de cobro', text: 'Si una venta cerrada aún no tiene plan, aparece a la derecha con el botón "+ Plan" para crearlo.' },
      { title: 'Pagos parciales', text: 'Si te pagan menos de la cuota, se registra como abono y el saldo sigue pendiente.' },
      { title: 'Antigüedad de la deuda', text: 'Cuánto está vencido de 1 a 15 días, de 16 a 30 y más de 30. Mientras más días pasan, más difícil es cobrar.' },
      { title: 'Por cobrar por país', text: 'Lo pendiente en cada país y, en rojo, la parte que ya está vencida.' },
    ],
    tips: [
      'Vendex te avisa en "Hoy" y en la campana dos días antes de cada vencimiento y cuando un pago se atrasa.',
      'El número rojo junto a "Cobros" en el menú es la cantidad de cuotas vencidas o que vencen hoy.',
    ],
  },

  planeacion: {
    short: 'Planeación',
    title: 'Planeación y estrategia',
    intro: 'Convierte la meta del mes en un ritmo de trabajo concreto: cuántos prospectos, llamadas y cotizaciones necesitas. Y reúne la estrategia de la semana para todo el equipo.',
    steps: [
      'Mira la meta del mes y los tres números grandes: prospectos por semana, llamadas por día y cotizaciones por semana.',
      'Revisa "Meta por país" para ver cuánto se vendió y cuánto está en juego en cada país.',
      'Lee el Tablero de estrategia semanal: enfoques, promociones y guiones de venta del equipo.',
    ],
    features: [
      { title: 'Simulador de meta', text: 'Mueve la barra de la meta y Vendex recalcula el trabajo necesario para alcanzarla.', roles: ['gerente'] },
      { title: 'Simulador de meta', text: 'Muestra el trabajo necesario para alcanzar la meta del equipo. La meta la define tu gerente.', roles: ['vendedor'] },
      { title: 'Ajustar supuestos', text: 'Ticket promedio, porcentaje de cotizaciones que se cierran, de prospectos que piden cotización y llamadas por prospecto.', roles: ['gerente'] },
      { title: 'Meta por país', text: 'En verde lo vendido este mes; en azul claro lo que está en cotización o negociación.' },
      { title: 'Tablero de estrategia', text: 'Tarjetas con el enfoque de la semana, las promociones vigentes y guiones de venta. Los guiones se copian con un toque para usarlos en llamadas o WhatsApp.' },
      { title: 'Editar el tablero', text: 'Con "+ Tarjeta" agregas una nueva; con el lápiz y la papelera editas o borras las existentes.', roles: ['gerente'] },
    ],
    tips: [
      'Si las llamadas por día te parecen muchas, mejora la tasa de cierre: el simulador te muestra cuánto trabajo te ahorra.',
    ],
  },

  equipo: {
    short: 'Equipo',
    title: 'Equipo y accesos',
    intro: 'Aquí das acceso a Vendex a tus vendedores y gerentes. Cada vendedor ve solo sus clientes, tratos y cobros; el gerente ve a todo el equipo.',
    steps: [
      'Toca "Agregar usuario", escribe su correo y nombre, y elige su rol: Vendedor o Gerente.',
      'Según el método de tu empresa, le llega un correo para crear su contraseña, o tú le entregas una contraseña temporal.',
      'Sigue en la lista quién ya entró, y reenvía o anula las invitaciones pendientes.',
    ],
    features: [
      { title: 'Cupos', text: 'Tu plan incluye un número de usuarios. Las cuentas activas y las invitaciones pendientes ocupan cupo.' },
      { title: 'Vendedores sin cuenta', text: 'Vendedores que ya tienen clientes en Vendex pero aún no pueden entrar. Al darles acceso, su cuenta queda unida a sus clientes y cobros.' },
      { title: 'Invitaciones', text: 'El enlace vence en 7 días. Puedes reenviarlo o anularlo desde la pestaña Invitaciones.' },
      { title: 'Contraseña temporal', text: 'Si tu empresa usa alta directa, defines o generas una clave y se la entregas por un canal privado. Al entrar, el usuario la cambia por una propia.' },
      { title: 'Desactivar', text: 'Quita el acceso a un usuario sin borrar sus clientes ni su historial. Puedes reactivarlo cuando quieras.' },
    ],
    tips: [
      'Desactiva de inmediato a quien deje la empresa: sus clientes se conservan y liberas el cupo.',
      'En el menú de la izquierda, toca a un vendedor del Equipo comercial para ver el tablero solo con sus datos.',
    ],
  },

  admin: {
    short: 'Empresas',
    title: 'Panel de plataforma',
    intro: 'Desde aquí das de alta a las empresas que usan Vendex y a su primer gerente. Después, cada gerente arma su propio equipo.',
    steps: [
      'Toca "Nueva empresa" y completa su nombre, plan, cupos de usuarios y datos de facturación.',
      'Elige el método de alta de usuarios: invitación por correo o contraseña directa.',
      'Agrega al gerente: recibe una invitación o queda activo con una contraseña temporal que le entregas tú.',
    ],
    features: [
      { title: 'Estados', text: 'Activa, En prueba, Esperando gerente o Suspendida. Una empresa suspendida no puede entrar a Vendex.' },
      { title: 'Editar empresa', text: 'Con el lápiz cambias el plan, los cupos, el estado, el método de alta y los datos de facturación.' },
      { title: 'Buscar', text: 'Encuentra una empresa por nombre, RUC o correo de su gerente.' },
    ],
    tips: [
      'Entrega las contraseñas temporales por un canal privado: no se vuelven a mostrar.',
    ],
  },
}

/** Lo que es igual en todos los módulos de ventas: barra superior y menú */
export const BASICS = [
  { title: 'Nuevo trato', text: 'El botón azul de arriba (o el + flotante en el celular) registra una oportunidad desde cualquier pantalla.' },
  { title: 'País', text: 'Todos, Perú, Bolivia o Venezuela: filtra clientes, tratos y cobros de todo el sistema.' },
  { title: 'Moneda', text: 'Elige en qué moneda ver los montos. Vendex convierte con el tipo de cambio del día.' },
  { title: 'Tipo de cambio', text: 'Se actualiza solo desde el banco central de cada país (BCRP, BCB y BCV). Desde el menú de moneda, "Editar tipo de cambio del día" permite traerlo al momento o ajustarlo a mano.', roles: ['gerente'] },
  { title: 'Vendedor', text: 'Elige un vendedor para ver todo el sistema solo con sus datos, o "Todos los vendedores".', roles: ['gerente'] },
  { title: 'Campana', text: 'Reúne tus seguimientos de hoy y mañana y los cobros de los próximos días. El número rojo son los urgentes.' },
  { title: 'Ficha del cliente', text: 'Toca el nombre de un cliente en cualquier pantalla para abrir su ficha completa.' },
]

/** Quita los elementos que no son para el rol */
export const forRole = (items = [], role) => items.filter((x) => !x.roles || x.roles.includes(role))
