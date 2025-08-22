<template>
  <div v-if="showPrompt" class="ios-install-prompt">
    <div class="prompt-content">
      <button class="close-btn" @click="closePrompt">&times;</button>
      <div class="prompt-header">
        <img src="/apple-touch-icon.png" alt="App Icon" class="app-icon" />
        <h3>Install ScavHunt</h3>
      </div>
      <p>Add this app to your home screen for the best experience!</p>
      <div class="install-steps">
        <div class="step">
          <span class="step-number">1</span>
          <span class="step-text">Tap the share button</span>
          <svg class="share-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
          </svg>
        </div>
        <div class="step">
          <span class="step-number">2</span>
          <span class="step-text">Tap "Add to Home Screen"</span>
        </div>
        <div class="step">
          <span class="step-number">3</span>
          <span class="step-text">Tap "Add" to confirm</span>
        </div>
      </div>
      <button class="later-btn" @click="remindLater">Maybe Later</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const showPrompt = ref(false)

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isInStandaloneMode(): boolean {
  return (window.matchMedia('(display-mode: standalone)').matches) || 
         ((window.navigator as any).standalone === true)
}

function closePrompt() {
  showPrompt.value = false
  localStorage.setItem('ios-install-prompt-dismissed', Date.now().toString())
}

function remindLater() {
  showPrompt.value = false
  const remindAfter = Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  localStorage.setItem('ios-install-prompt-remind', remindAfter.toString())
}

onMounted(() => {
  // Only show on iOS devices that aren't in standalone mode
  if (!isIOS() || isInStandaloneMode()) {
    return
  }

  // Check if user has dismissed the prompt
  const dismissed = localStorage.getItem('ios-install-prompt-dismissed')
  if (dismissed) {
    return
  }

  // Check if user chose to be reminded later
  const remindTime = localStorage.getItem('ios-install-prompt-remind')
  if (remindTime && Date.now() < parseInt(remindTime)) {
    return
  }

  // Show the prompt after a brief delay
  setTimeout(() => {
    showPrompt.value = true
  }, 2000)
})
</script>

<style scoped>
.ios-install-prompt {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 9999;
  animation: fadeIn 0.3s ease-out;
}

.prompt-content {
  background: white;
  border-radius: 20px 20px 0 0;
  padding: 24px;
  width: 100%;
  position: relative;
  animation: slideUp 0.3s ease-out;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 8px;
  line-height: 1;
}

.prompt-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.app-icon {
  width: 60px;
  height: 60px;
  border-radius: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.prompt-header h3 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.prompt-content p {
  color: #666;
  margin-bottom: 24px;
  font-size: 16px;
}

.install-steps {
  margin-bottom: 24px;
}

.step {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #555;
}

.step-number {
  background: #007AFF;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 12px;
  flex-shrink: 0;
}

.share-icon {
  width: 20px;
  height: 20px;
  color: #007AFF;
  margin-left: auto;
}

.later-btn {
  width: 100%;
  padding: 12px;
  background: #f5f5f5;
  border: none;
  border-radius: 8px;
  color: #333;
  font-size: 16px;
  cursor: pointer;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
</style>
