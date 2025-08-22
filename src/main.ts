import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(router)

app.mount('#app')

// PWA Update prompt
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content is available. Reload to update?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

// Add iOS PWA install prompt
let deferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  deferredPrompt = e;
});

// For iOS, we need to show custom install instructions
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (window.matchMedia('(display-mode: standalone)').matches) || 
         ((window.navigator as any).standalone === true);
}

// Show iOS install prompt if not already installed
if (isIOS() && !isInStandaloneMode()) {
  // You can show a custom install banner here
  console.log('iOS device detected - show custom install instructions');
}
