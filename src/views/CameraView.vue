<template>
	<div class="camera-container">
		<!-- Enhanced Header with logo and controls -->
		<div class="header">
			<div class="header-left">
				<button @click="flipCamera" class="control-btn">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M21 2v6h-6" />
						<path d="M3 12a9 9 0 0 1 9-9c2.52 0 4.85 1 6.58 2.58L21 8" />
						<path d="M3 22v-6h6" />
						<path d="M21 12a9 9 0 0 1-9 9c-2.52 0-4.85-1-6.58-2.58L3 16" />
					</svg>
				</button>
				<button @click="toggleScreenFlip" class="control-btn">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
						<line x1="8" y1="21" x2="16" y2="21" />
						<line x1="12" y1="17" x2="12" y2="21" />
						<path d="M7 13l5-5 5 5" />
					</svg>
				</button>
			</div>

			<div class="header-center">
				<MalibanLogo class="header-logo" />
			</div>

			<div class="header-right">
				<div class="user-info">
					<span class="phone">{{ userPhone }}</span>
				</div>
				<div class="progress">
					{{ detectedShapes.size }}/6 Found
				</div>
			</div>
		</div>

		<!-- Camera view with grid overlay -->
		<div class="camera-view" ref="cameraView" :class="{ flipped: isScreenFlipped }">
			<div id="webcam-container" ref="webcamContainer"></div>

			<!-- 6-grid overlay -->
			<div class="grid-overlay">
				<div v-for="(cell, index) in gridCells" :key="index" class="grid-cell"
					:class="{ filled: cell.filled, active: cell.active }">
					<div v-if="cell.filled" class="shape-content">
						<img :src="cell.overlayImage" alt="detected shape" class="overlay-image" />
						<span class="shape-name">{{ cell.shapeName }}</span>
					</div>
				</div>
			</div>

			<!-- Detection feedback -->
			<div class="detection-info">
				<div v-if="currentDetection" class="current-detection">
					<div v-if="selectedClasses.includes(currentDetection.className) && detectionTracker.has(currentDetection.className)"
						class="detection-progress">
						<div class="progress-bar">
							<div class="progress-fill"
								:style="{ width: `${((detectionTracker.get(currentDetection.className)?.count || 0) / DETECTION_THRESHOLD) * 100}%` }">
							</div>
						</div>
						<span class="progress-text">Hold steady</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Success modal -->
		<div v-if="gameCompleted" class="success-modal">
			<div class="modal-content">
				<img src="/win.jpg" alt="You Win!" class="win-image" />
				<h2>🎉 Congratulations!</h2>
				<p>You've found all 6 items!</p>
				<p>Hunt completed in {{ formatTime(completionTime) }}</p>

				<div class="game-rules">
					<h3>🎁 Game Rules</h3>
					<ol>
						<li>Download the given image.</li>
						<li>Share it on your Facebook story and tag the official Maliban page.</li>
						<li>Winners will be selected every hour through a raffle draw.</li>
						<li>Each winner will receive a special Maliban gift hamper.</li>
					</ol>
				</div>

				<button @click="goHome" class="home-btn">Go Home</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
/**
 * Camera-stable version for iOS/Safari:
 * - Uses facingMode inside video constraints
 * - Avoids strict deviceId on iOS
 * - Fully releases previous MediaStreams before reinit
 * - Guards against double init and duplicate RAF loops
 * - Ensures inline playback on iOS (playsinline, muted)
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import * as tmImage from '@teachablemachine/image'
import MalibanLogo from '../components/MalibanLogo.vue' // keep import if referenced in your template

const router = useRouter()

/* =========================
   User / Game State
   ========================= */
const userName = ref('')
const userPhone = ref('')
const participantId = ref('')

const detectedShapes = ref(new Set<string>())
const gameCompleted = ref(false)
const startTime = ref(Date.now())
const completionTime = ref(0)
const selectedClasses = ref<string[]>([])

// detection tracking (2 seconds at ~30 FPS)
const detectionTracker = ref(new Map<string, { count: number, lastDetected: number }>())
const DETECTION_THRESHOLD = 60
const CONFIDENCE_THRESHOLD = 0.7

/* =========================
   Camera / Model
   ========================= */
const isScreenFlipped = ref(false)
let model: tmImage.CustomMobileNet
let webcam: tmImage.Webcam
const isModelLoaded = ref(false)
const currentDetection = ref<{ className: string; probability: number } | null>(null)

let videoDevices: MediaDeviceInfo[] = []
let currentDeviceIndex = 0
let isInitializing = false
let rafId: number | null = null

// Template refs
const cameraView = ref<HTMLElement>()
const webcamContainer = ref<HTMLElement>()

/* =========================
   Grid (3x2)
   ========================= */
const gridCells = ref(
  Array.from({ length: 6 }, (_, index) => ({
    filled: false,
    active: false,
    shape: '',
    overlayImage: '',
    shapeName: '',
    id: index,
  }))
)

const shapePositions = ref(new Map<string, number>())

// OPTIONAL: helper, some Androids report "rear"/"back" vs "environment"
const isAndroid = () => /Android/i.test(navigator.userAgent)

// Map labels to a likely device for a facing
const pickDeviceIdForFacing = (facing: 'environment' | 'user'): string | null => {
  if (!videoDevices?.length) return null
  const want = facing === 'environment'
    ? ['back', 'rear', 'environment', 'world']
    : ['front', 'user', 'selfie', 'face']
  const dev = videoDevices.find(d => want.some(w =>
    (d.label || '').toLowerCase().includes(w)
  ))
  return dev?.deviceId || null
}

const MODEL_URL = '/my_model/'

// Valid and neutral classes
const VALID_CLASSES = [
  'yahaposha', 'vitegen', 'tea_logo', 'zellers', 'nonfat', 'vitagen',
  'fit text non fat', 'not fat', 'tea_leaf', 'tea cup', 'tea_text',
  'tea_pack', '400g nonfat', 'tempo_biscuit', 'tempo_logo_logo', 'tempo_pack'
]
const NEUTRAL_CLASSES = ['ape_kelly_bonus', 'Class 18'] // (kept for reference)

const initializeRandomClasses = () => {
  selectedClasses.value = [...VALID_CLASSES]
  const userData = localStorage.getItem('scavhunt_user')
  if (userData) {
    const user = JSON.parse(userData)
    const gameData = {
      participant_id: participantId.value,
      selectedClasses: selectedClasses.value,
      detectedClasses: [],
      completed: false,
      startTime: Date.now(),
    }
    localStorage.setItem(`game_${user.phone}`, JSON.stringify(gameData))
  }
}

/* =========================
   Lifecycle
   ========================= */
onMounted(async () => {
  // Get user data
  const userData = localStorage.getItem('scavhunt_user')
  if (!userData) {
    router.push('/')
    return
  }

  const user = JSON.parse(userData)
  userName.value = user.name
  userPhone.value = user.phone

  if (!user.id) {
    console.error('No participant ID found. User may not be properly registered.')
    alert('Registration data is incomplete. Please register again.')
    router.push('/')
    return
  }
  participantId.value = user.id

  const gameData = localStorage.getItem(`game_${user.phone}`)
  if (gameData) {
    const parsedGameData = JSON.parse(gameData)
    if (parsedGameData.completed) {
      alert('You have already completed this game!')
      router.push('/')
      return
    }
  }

  initializeRandomClasses()

  // Ensure permission prompt so device labels populate
  try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch {}

  await getCameras()


  // Default to back cam
  desiredFacing.value = 'environment'

  // OPTIONAL but helpful: pre-resolve both ids so flips are instant & correct
  await Promise.all([
    resolveDeviceIdForFacing('environment'),
    resolveDeviceIdForFacing('user'),
  ])

  await initializeCamera()

  document.addEventListener('visibilitychange', onVisibilityChange)
})
/* =========================
   Camera helpers
   ========================= */
const hardStopWebcam = async () => {
  try {
    if (webcam) {
      try { await webcam.stop() } catch {}
      const vid = (webcam as any)?.webcam as HTMLVideoElement | undefined
      const stream: MediaStream | undefined = vid?.srcObject as any
      if (stream) {
        stream.getTracks().forEach(t => {
          try { t.stop() } catch {}
        })
        // Clear srcObject to fully release on Safari
        if (vid) {
          vid.srcObject = null
          // @ts-ignore
          vid.removeAttribute('srcObject')
        }
      }
      try {
        webcam.canvas?.parentNode?.removeChild(webcam.canvas)
      } catch {}
    }
  } catch {}
}
onUnmounted(async () => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  if (rafId) cancelAnimationFrame(rafId)
  await hardStopWebcam()
})
const desiredFacing = ref<'environment' | 'user'>('environment')

// Cache resolved deviceIds per facing after we successfully probe them
const resolvedIds: Record<'environment' | 'user', string | null> = {
  environment: null,
  user: null,
}
/* =========================
   Platform helpers
   ========================= */
// Small util
const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1)

/**
 * Probe the camera for a specific facing with facingMode:{exact},
 * extract the actual deviceId from the track, stop the probe stream,
 * cache and return it.
 */
const resolveDeviceIdForFacing = async (facing: 'environment' | 'user'): Promise<string | null> => {
  // If we already resolved it, reuse
  if (resolvedIds[facing]) return resolvedIds[facing]

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: facing } as any }
    })
    const track = stream.getVideoTracks()[0]
    const id = (track.getSettings && track.getSettings().deviceId) || null
    // Stop probe stream immediately
    track.stop()
    if (id) resolvedIds[facing] = id
    return id
  } catch {
    // Some Androids reject exact; fall back to heuristic resolution
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      const vids = all.filter(d => d.kind === 'videoinput')
      // Heuristic by label
      const want = facing === 'environment'
        ? ['back', 'rear', 'environment', 'world']
        : ['front', 'user', 'selfie', 'face']
      const match = vids.find(v => want.some(w => (v.label || '').toLowerCase().includes(w)))
      resolvedIds[facing] = match?.deviceId || null
      return resolvedIds[facing]
    } catch {
      return null
    }
  }
}

const getCameras = async () => {
  const devices = await navigator.mediaDevices.enumerateDevices()
  videoDevices = devices.filter(d => d.kind === 'videoinput')

  const backIndex = videoDevices.findIndex(d =>
    (d.label || '').toLowerCase().includes('back') ||
    (d.label || '').toLowerCase().includes('environment')
  )
  currentDeviceIndex = backIndex >= 0 ? backIndex : 0
}

const buildConstraints = async (strict = true) => {
  const base: MediaTrackConstraints = {
    width: { ideal: 640 },
    height: { ideal: 480 },
  }

  // iOS prefers facingMode, Android is happiest with deviceId:exact (once we know it)
  if (isIOS()) {
    const facingExact = strict ? { exact: desiredFacing.value } : desiredFacing.value
    return { video: { ...base, facingMode: facingExact as any } }
  }

  // ANDROID / OTHERS: try to resolve deviceId for this facing
  const id = await resolveDeviceIdForFacing(desiredFacing.value)

  if (id) {
    // Open this exact device to force the correct lens
    return { video: { ...base, deviceId: { exact: id } as any } }
  }

  // Fallback to facingMode if we couldn't resolve an id
  const facingExact = strict ? { exact: desiredFacing.value } : desiredFacing.value
  return { video: { ...base, facingMode: facingExact as any } }
}


/* =========================
   Init / Loop
   ========================= */
// UPDATE your initializeCamera() to call a verifier after play:
const initializeCamera = async () => {
  if (isInitializing) return
  isInitializing = true
  try {
    if (!model) {
      const modelURL = MODEL_URL + 'model.json'
      const metadataURL = MODEL_URL + 'metadata.json'
      model = await tmImage.load(modelURL, metadataURL)
      isModelLoaded.value = true
    }

    await hardStopWebcam()
    if (webcamContainer.value) webcamContainer.value.innerHTML = ''

    // IMPORTANT: await constraints (we resolve deviceIds here)
    const constraints = await buildConstraints(true)

    webcam = new tmImage.Webcam(640, 480, false)
    await webcam.setup(constraints)
    await webcam.play()

    const vid = (webcam as any)?.webcam as HTMLVideoElement | undefined
    if (vid) {
      vid.setAttribute('playsinline', 'true')
      vid.setAttribute('muted', 'true')
      try { await vid.play() } catch {}
    }

    if (webcamContainer.value) {
      webcamContainer.value.appendChild(webcam.canvas)
      webcam.canvas.style.width = '100%'
      webcam.canvas.style.height = '100%'
      webcam.canvas.style.objectFit = 'cover'
    }

    if (rafId) cancelAnimationFrame(rafId)
    const tick = async () => {
      if (!gameCompleted.value && webcam && model) {
        webcam.update()
        await predict()
        rafId = requestAnimationFrame(tick)
      }
    }
    rafId = requestAnimationFrame(tick)
  } catch (err) {
    console.error('Error initializing camera:', err)
    alert('Error accessing camera. Please check permissions or try another device.')
  } finally {
    isInitializing = false
  }
}

// ADD this verifier helper:
const verifyFacingAndRetry = async () => {
  try {
    const track = (webcam as any)?.webcam?.srcObject?.getVideoTracks?.()[0] as MediaStreamTrack | undefined
    const reported = track?.getSettings?.().facingMode // e.g. 'environment' | 'user' | undefined
    if (!reported) return

    // If it didn't switch, try one strict retry with exact facing and (if present) exact deviceId
    if (reported !== desiredFacing.value) {
      await hardStopWebcam()

      // strict=true uses facingMode: { exact: ... }
      const strictConstraints = buildConstraints(true)
      webcam = new tmImage.Webcam(640, 480, false)
      await webcam.setup(strictConstraints)
      await webcam.play()

      const vid = (webcam as any)?.webcam as HTMLVideoElement | undefined
      if (vid) {
        vid.setAttribute('playsinline', 'true')
        vid.setAttribute('muted', 'true')
        try { await vid.play() } catch {}
      }

      if (webcamContainer.value) {
        webcamContainer.value.innerHTML = ''
        webcamContainer.value.appendChild(webcam.canvas)
        webcam.canvas.style.width = '100%'
        webcam.canvas.style.height = '100%'
        webcam.canvas.style.objectFit = 'cover'
      }
    }
  } catch (e) {
    console.warn('verifyFacingAndRetry failed:', e)
  }
}


const onVisibilityChange = async () => {
  if (document.visibilityState === 'hidden') {
    if (rafId) cancelAnimationFrame(rafId)
    await hardStopWebcam()
  } else if (document.visibilityState === 'visible' && !gameCompleted.value) {
    await initializeCamera()
  }
}

/* =========================
   Prediction
   ========================= */
const predict = async () => {
  if (!model || !webcam) return

  try {
    const predictions = await model.predict(webcam.canvas)

    // Find the highest confidence prediction
    let bestPrediction = predictions[0]
    for (let i = 1; i < predictions.length; i++) {
      if (predictions[i].probability > bestPrediction.probability) {
        bestPrediction = predictions[i]
      }
    }

    currentDetection.value = bestPrediction

    // Track detections for consistency
    if (
      bestPrediction.probability > CONFIDENCE_THRESHOLD &&
      selectedClasses.value.includes(bestPrediction.className)
    ) {
      const className = bestPrediction.className
      const currentTime = Date.now()

      if (!detectionTracker.value.has(className)) {
        detectionTracker.value.set(className, { count: 1, lastDetected: currentTime })
      } else {
        const tracker = detectionTracker.value.get(className)!
        if (currentTime - tracker.lastDetected < 500) {
          tracker.count++
          tracker.lastDetected = currentTime
        } else {
          tracker.count = 1
          tracker.lastDetected = currentTime
        }

        if (tracker.count >= DETECTION_THRESHOLD) {
          await handleShapeDetection(className)
          detectionTracker.value.delete(className)
        }
      }
    }

    // Clean up old trackers
    const now = Date.now()
    for (const [className, tracker] of detectionTracker.value.entries()) {
      if (now - tracker.lastDetected > 1000) {
        detectionTracker.value.delete(className)
      }
    }
  } catch (error) {
    console.error('Prediction error:', error)
  }
}

/* =========================
   Detection Handling
   ========================= */
const handleShapeDetection = async (shapeName: string) => {
  if (!selectedClasses.value.includes(shapeName) || detectedShapes.value.has(shapeName)) {
    return
  }

  detectedShapes.value.add(shapeName)

  // Update localStorage
  const userData = localStorage.getItem('scavhunt_user')
  if (userData) {
    const user = JSON.parse(userData)
    const gameData = JSON.parse(localStorage.getItem(`game_${user.phone}`) || '{}')
    gameData.detectedClasses = Array.from(detectedShapes.value)
    localStorage.setItem(`game_${user.phone}`, JSON.stringify(gameData))
  }

  // Assign a random grid position if not already assigned
  if (!shapePositions.value.has(shapeName)) {
    const availablePositions = gridCells.value
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => !cell.filled)
      .map(({ index }) => index)

    if (availablePositions.length > 0) {
      const randomPosition = availablePositions[Math.floor(Math.random() * availablePositions.length)]
      shapePositions.value.set(shapeName, randomPosition)

      // Fill the grid cell
      gridCells.value[randomPosition].filled = true
      gridCells.value[randomPosition].shape = getShapeEmoji(shapeName)
      gridCells.value[randomPosition].overlayImage = getOverlayImage(randomPosition + 1)
      gridCells.value[randomPosition].shapeName = shapeName
      gridCells.value[randomPosition].active = true

      setTimeout(() => {
        gridCells.value[randomPosition].active = false
      }, 1000)

      await new Promise(resolve => setTimeout(resolve, 10))
      await updateGameProgress(shapeName)

      // Complete after 6 found
      if (detectedShapes.value.size >= 6) {
        completionTime.value = Date.now() - startTime.value
        await completeGame()
      }
    }
  }
}

const updateGameProgress = async (detectedClassName: string) => {
  const userData = localStorage.getItem('scavhunt_user')
  if (!userData) return

  const user = JSON.parse(userData)
  try {
    const progressData = {
      participant_id: participantId.value,
      phone: user.phone,
      name: user.name,
      selectedClasses: selectedClasses.value,
      detectedClasses: Array.from(detectedShapes.value),
      latestDetection: detectedClassName,
      currentProgress: detectedShapes.value.size,
      gridProgress: gridCells.value.filter(cell => cell.filled).length,
      gridState: gridCells.value.map((cell, index) => ({
        position: index,
        filled: cell.filled,
        shapeName: cell.shapeName,
        overlayImage: cell.overlayImage,
        shape: cell.shape,
      })),
      totalRequired: 6,
      completed: false,
      timestamp: Date.now(),
      startTime: startTime.value,
    }

    await fetch('https://malibanscav.dev.artslabcreatives.com/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(progressData),
    })
  } catch (error) {
    console.error('Error sending progress update:', error)
  }
}

const completeGame = async () => {
  gameCompleted.value = true

  const userData = localStorage.getItem('scavhunt_user')
  if (userData) {
    const user = JSON.parse(userData)
    const gameData = JSON.parse(localStorage.getItem(`game_${user.phone}`) || '{}')
    gameData.completed = true
    gameData.completionTime = completionTime.value
    gameData.endTime = Date.now()
    localStorage.setItem(`game_${user.phone}`, JSON.stringify(gameData))

    try {
      const uploadData = {
        participant_id: participantId.value,
        phone: user.phone,
        name: user.name,
        selectedClasses: selectedClasses.value,
        detectedClasses: Array.from(detectedShapes.value),
        completionTime: completionTime.value,
        startTime: startTime.value,
        endTime: Date.now(),
        gridProgress: gridCells.value.filter(cell => cell.filled).length,
        gridState: gridCells.value.map((cell, index) => ({
          position: index,
          filled: cell.filled,
          shapeName: cell.shapeName,
          overlayImage: cell.overlayImage,
          shape: cell.shape,
        })),
        totalGridCells: 6,
        completed: true,
        finalCompletion: true,
      }

      await fetch('https://malibanscav.dev.artslabcreatives.com/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadData),
      })
    } catch (error) {
      console.error('Error uploading game data:', error)
    }
  }
}

/* =========================
   Utils
   ========================= */
const getShapeEmoji = (shapeName: string): string => {
  const emojiMap: Record<string, string> = {
    'circle': '⭕',
    'square': '⬜',
    'triangle': '🔺',
    'star': '⭐',
    'heart': '❤️',
    'diamond': '💎',
    'default': '🔷',
  }
  return emojiMap[shapeName.toLowerCase()] || emojiMap.default
}

const getOverlayImage = (cellNumber: number): string => {
  const paddedNumber = cellNumber.toString().padStart(2, '0')
  return `/images/overlay_${paddedNumber}.png`
}

const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

/* =========================
   Controls (used in template)
   ========================= */
// REPLACE flipCamera() with this (works on Android & iOS):
const flipCamera = async () => {
  try {
    // Toggle desired camera
    desiredFacing.value = desiredFacing.value === 'environment' ? 'user' : 'environment'
    // Mirror visually only when using front camera
    isScreenFlipped.value = desiredFacing.value === 'user'

    await hardStopWebcam()
    await initializeCamera()
  } catch (err) {
    console.error('Error flipping camera:', err)
  }
}

const toggleScreenFlip = async () => {
  isScreenFlipped.value = !isScreenFlipped.value
  // Reinitialize so facingMode actually changes on iOS
  await initializeCamera()
}

const resetGame = () => {
  detectedShapes.value.clear()
  detectionTracker.value.clear()
  shapePositions.value.clear()
  gridCells.value.forEach(cell => {
    cell.filled = false
    cell.active = false
    cell.shape = ''
    cell.overlayImage = ''
    cell.shapeName = ''
  })
  gameCompleted.value = false
  startTime.value = Date.now()
  completionTime.value = 0

  const userData = localStorage.getItem('scavhunt_user')
  if (userData) {
    const user = JSON.parse(userData)
    localStorage.removeItem(`game_${user.phone}`)
    initializeRandomClasses()
  }
}

const goHome = async () => {
  if (rafId) cancelAnimationFrame(rafId)
  await hardStopWebcam()
  router.push('/')
}

// Expose anything referenced in the template (if using <script setup>, refs are auto-exposed)
</script>


<style scoped>
.camera-container {
	position: relative;
	width: 100vw;
	height: 100vh;
	max-height: 100vh;
	overflow: hidden;
	background: #000;
}

.header {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	background: rgba(17, 60, 102, 0.9);
	color: white;
	padding: 10px 20px;
	display: flex;
	justify-content: space-between;
	align-items: center;
	z-index: 10;
	backdrop-filter: blur(10px);
}

.header-left {
	display: flex;
	gap: 10px;
	align-items: center;
	flex: 1;
}

.header-center {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: center;
}

.header-right {
	flex: 1;
	display: flex;
	justify-content: flex-end;
	align-items: center;
	gap: 15px;
}

.header-logo {
	height: 40px;
	width: auto;
}

.control-btn {
	background: rgba(226, 11, 29, 0.8);
	border: none;
	border-radius: 8px;
	padding: 8px;
	color: white;
	cursor: pointer;
	transition: background-color 0.3s ease;
	display: flex;
	align-items: center;
	justify-content: center;
}

.control-btn:hover {
	background: rgba(226, 11, 29, 1);
}

.user-info h2 {
	margin: 0;
	font-size: 1.2rem;
}

.phone {
	font-size: 0.9rem;
	opacity: 0.8;
}

.progress {
	font-size: 1.1rem;
	font-weight: bold;
	color: #ffd700;
	background: rgba(226, 11, 29, 0.8);
	padding: 5px 10px;
	border-radius: 5px;
}

.camera-view {
	position: relative;
	width: 100%;
	height: 100%;
	transition: transform 0.3s ease;
}

.camera-view.flipped {
	transform: scaleX(-1);
}

#webcam-container {
	width: 100%;
	height: 100%;
}

.grid-overlay {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	grid-template-rows: repeat(2, 1fr);
	gap: 2px;
	padding: 60px 10px 10px;
	pointer-events: none;
	z-index: 5;
}

.grid-cell {
	border: 2px solid rgba(255, 255, 255, 0.3);
	background: rgba(0, 0, 0, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.3s ease;
	border-radius: 8px;
}

.grid-cell.filled {
	background: rgba(226, 11, 29, 0.3);
	border-color: #e20b1d;
}

.grid-cell.active {
	animation: pulse 1s ease-in-out;
	border-color: #FFD700;
	background: rgba(255, 215, 0, 0.3);
}

.shape-content {
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.overlay-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
	opacity: 0.7;
	border-radius: 4px;
}

.shape-name {
	position: absolute;
	bottom: 2px;
	left: 50%;
	transform: translateX(-50%);
	font-size: 8px;
	color: white;
	background: rgba(0, 0, 0, 0.7);
	padding: 1px 3px;
	border-radius: 2px;
	text-transform: uppercase;
	font-weight: bold;
	letter-spacing: 0.5px;
}

.detection-info {
	position: absolute;
	bottom: 20px;
	left: 50%;
	transform: translateX(-50%);
	z-index: 10;
}

.current-detection {
	background: rgba(0, 0, 0, 0.8);
	color: white;
	padding: 10px 20px;
	border-radius: 25px;
	display: flex;
	flex-direction: column;
	gap: 5px;
	align-items: center;
}

.detection-label {
	font-weight: bold;
}

.confidence {
	color: #ffd700;
	font-size: 0.9rem;
}

.detection-progress {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 5px;
	margin-top: 5px;
}

.progress-bar {
	width: 100px;
	height: 4px;
	background: rgba(255, 255, 255, 0.3);
	border-radius: 2px;
	overflow: hidden;
}

.progress-fill {
	height: 100%;
	background: #ffd700;
	transition: width 0.1s ease;
}

.progress-text {
	font-size: 0.8rem;
	color: #ffd700;
}

.success-modal {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.8);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 20;
}

.modal-content {
	background: white;
	padding: 40px;
	border-radius: 16px;
	text-align: center;
	max-width: 400px;
	width: 90%;
	max-height: 80vh;
	overflow-y: auto;
}

.win-image {
	width: 100%;
	max-width: 300px;
	height: auto;
	border-radius: 8px;
	margin-bottom: 20px;
}

.modal-content h2 {
	color: #e20b1d;
	margin-bottom: 20px;
}

.modal-content p {
	margin-bottom: 15px;
	color: #333;
}

.game-rules {
	background: #f8f9fa;
	border: 2px solid #e20b1d;
	border-radius: 10px;
	padding: 20px;
	margin: 20px 0;
	text-align: left;
}

.game-rules h3 {
	color: #e20b1d;
	margin: 0 0 15px 0;
	text-align: center;
	font-size: 1.2rem;
}

.game-rules ol {
	margin: 0;
	padding-left: 20px;
	color: #333;
}

.game-rules li {
	margin-bottom: 8px;
	font-size: 0.95rem;
	line-height: 1.4;
}

.reset-btn,
.home-btn {
	padding: 12px 24px;
	margin: 5px;
	border: none;
	border-radius: 8px;
	cursor: pointer;
	font-weight: bold;
	transition: background-color 0.3s ease;
}

.reset-btn {
	background: #e20b1d;
	color: white;
}

.reset-btn:hover {
	background: #cc0918;
}

.home-btn {
	background: #113c66;
	color: white;
}

.home-btn:hover {
	background: #0d2f52;
}

@keyframes pulse {
	0% {
		transform: scale(1);
		box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7);
	}

	70% {
		transform: scale(1.05);
		box-shadow: 0 0 0 10px rgba(255, 215, 0, 0);
	}

	100% {
		transform: scale(1);
		box-shadow: 0 0 0 0 rgba(255, 215, 0, 0);
	}
}

@media (max-width: 768px) {
	body {
		overflow: hidden;
		position: fixed;
		width: 100%;
		height: 100%;
	}

	.header {
		padding: 8px 10px;
		height: 60px;
	}

	.header-left,
	.header-center,
	.header-right {
		flex: 1;
	}

	.header-left {
		justify-content: flex-start;
		gap: 5px;
	}

	.header-center {
		justify-content: center;
	}

	.header-right {
		justify-content: flex-end;
		gap: 8px;
	}

	.header-logo {
		height: 25px;
	}

	.user-info h2 {
		font-size: 0.8rem;
		margin: 0;
	}

	.user-info .phone {
		font-size: 0.7rem;
	}

	.progress {
		font-size: 0.8rem;
		padding: 2px 6px;
	}

	.control-btn {
		padding: 4px;
		width: 30px;
		height: 30px;
	}

	.control-btn svg {
		width: 14px;
		height: 14px;
	}

	.grid-overlay {
		padding: 70px 5px 5px;
	}

	.shape-name {
		font-size: 6px;
		padding: 0.5px 2px;
	}

	.camera-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		overflow: hidden;
	}
}
</style>
