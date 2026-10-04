// Shared by the root layout (server) and the install button (client).
export const INSTALL_CHANGE_EVENT = 'lensspace:install-change'

// Inline in the root layout so `beforeinstallprompt` is kept even when the browser
// fires it before React hydrates. No preventDefault: Chrome's own mini-infobar
// still shows on Android, and the saved event can be prompted later from our button.
export const installPromptCaptureScript = `
window.addEventListener('beforeinstallprompt',function(e){window.__lensspaceInstallPrompt=e;window.dispatchEvent(new Event('${INSTALL_CHANGE_EVENT}'))});
window.addEventListener('appinstalled',function(){window.__lensspaceInstallPrompt=null;window.__lensspaceInstalled=true;window.dispatchEvent(new Event('${INSTALL_CHANGE_EVENT}'))});
`
