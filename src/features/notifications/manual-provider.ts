export type ManualNotification = {
  recipient: string
  message: string
}

export interface ManualNotificationProvider {
  buildUrl(notification: ManualNotification): string
}

export const whatsappManualProvider: ManualNotificationProvider = {
  buildUrl({ recipient, message }) {
    return `https://wa.me/${encodeURIComponent(recipient)}?text=${encodeURIComponent(message)}`
  },
}
