type PaymentError = { code?: string; message?: string } | null

export function friendlyPaymentError(error: PaymentError) {
  const message = error?.message ?? ''

  if (message.includes('supera el saldo pendiente')) {
    return 'Ese cobro supera el saldo pendiente. Reduce el importe e inténtalo nuevamente.'
  }
  if (message.includes('Solo el propietario') || message.includes('Solo un vendedor activo')) {
    return 'Tu usuario no está autorizado para recibir efectivo en esta sucursal. Debe ser el propietario activo o un vendedor activo de la sucursal.'
  }
  if (message.includes('Caja no está operativo') || message.includes('Caja no esta operativo')) {
    return 'El módulo Caja no está disponible para esta organización.'
  }
  if (message.includes('pedido está cerrado') || message.includes('pedido esta cerrado')) {
    return 'Este pedido está cerrado y ya no admite cobros.'
  }
  if (error?.code === '42501') {
    return 'No tienes permiso para registrar este cobro. Verifica tu acceso a la organización y la sucursal.'
  }
  return 'No pudimos registrar el cobro. Revisa el importe e inténtalo nuevamente.'
}
