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
					<h2>{{ userName }}</h2>
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
					<div v-if="cell.filled" class="shape-icon">
						{{ cell.shape }}
					</div>
				</div>
			</div>

			<!-- Detection feedback -->
			<div class="detection-info">
				<div v-if="currentDetection" class="current-detection">
					<span class="detection-label">{{ currentDetection.className }}</span>
					<span class="confidence">{{ (currentDetection.probability * 100).toFixed(1) }}%</span>
				</div>
			</div>
		</div>

		<!-- Success modal -->
		<div v-if="gameCompleted" class="success-modal">
			<div class="modal-content">
				<h2>🎉 Congratulations!</h2>
				<p>You've found all 6 shapes!</p>
				<p>Hunt completed in {{ formatTime(completionTime) }}</p>
				<button @click="resetGame" class="reset-btn">Play Again</button>
				<button @click="goHome" class="home-btn">Go Home</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import * as tmImage from '@teachablemachine/image'
import MalibanLogo from '../components/MalibanLogo.vue'

const router = useRouter()

// User data
const userName = ref('')
const userPhone = ref('')

// Game state
const detectedShapes = ref(new Set<string>())
const gameCompleted = ref(false)
const startTime = ref(Date.now())
const completionTime = ref(0)

// Camera controls
const isScreenFlipped = ref(false)
const useFrontCamera = ref(false)

// TensorFlow.js variables
let model: tmImage.CustomMobileNet
let webcam: tmImage.Webcam
let isModelLoaded = ref(false)
let currentDetection = ref<{ className: string; probability: number } | null>(null)
let videoDevices: MediaDeviceInfo[] = []
let currentDeviceIndex = 0
// Camera refs
const cameraView = ref<HTMLElement>()
const webcamContainer = ref<HTMLElement>()

// Grid system (3x2 grid = 6 cells)
const gridCells = ref(Array.from({ length: 6 }, (_, index) => ({
	filled: false,
	active: false,
	shape: '',
	id: index
})))

// Assign random positions for each user
const shapePositions = ref(new Map<string, number>())

const MODEL_URL = '/my_model/'

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

	// Initialize camera and model
	//await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
	await getCameras()
	await initializeCamera()
})

onUnmounted(() => {
	if (webcam) {
		webcam.stop()
	}
})

const getCameras = async () => {
	const devices = await navigator.mediaDevices.enumerateDevices()
	videoDevices = devices.filter(d => d.kind === "videoinput")

	// Prefer back camera as default if available
	const backIndex = videoDevices.findIndex(d =>
		d.label.toLowerCase().includes("back") ||
		d.label.toLowerCase().includes("environment")
	)

	currentDeviceIndex = backIndex >= 0 ? backIndex : 0
}

const initializeCamera = async () => {
	try {
		if (!model) {
			const modelURL = MODEL_URL + "model.json"
			const metadataURL = MODEL_URL + "metadata.json"
			model = await tmImage.load(modelURL, metadataURL)
			isModelLoaded.value = true
		}

		if (webcamContainer.value) {
			webcamContainer.value.innerHTML = ""
		}

		// Select correct camera by deviceId
		const deviceId = videoDevices[currentDeviceIndex]?.deviceId
		const constraints = {
			video: {
				deviceId: deviceId ? { exact: deviceId } : undefined,
				width: 640,
				height: 480
			}
		}

		webcam = new tmImage.Webcam(640, 480, false) // no auto-flip
		await webcam.setup({ facingMode: "environment" })
		await webcam.play()

		if (webcamContainer.value) {
			webcamContainer.value.appendChild(webcam.canvas)
			webcam.canvas.style.width = "100%"
			webcam.canvas.style.height = "100%"
			webcam.canvas.style.objectFit = "cover"
		}

		requestAnimationFrame(loop)
	} catch (err) {
		console.error("Error initializing camera:", err)
		alert("Error accessing camera. Please check permissions or try another device.")
	}
}


const loop = async () => {
	if (webcam && model && !gameCompleted.value) {
		webcam.update()
		await predict()
		requestAnimationFrame(loop)
	}
}

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

		// If confidence is high enough, consider it a detection
		if (bestPrediction.probability > 0.99) {
			handleShapeDetection(bestPrediction.className)
		}
	} catch (error) {
		console.error('Prediction error:', error)
	}
}

const handleShapeDetection = (shapeName: string) => {
	// If this shape hasn't been detected before
	if (!detectedShapes.value.has(shapeName)) {
		detectedShapes.value.add(shapeName)

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
				gridCells.value[randomPosition].active = true

				// Remove active class after animation
				setTimeout(() => {
					gridCells.value[randomPosition].active = false
				}, 1000)

				// Check if game is completed
				if (detectedShapes.value.size >= 6) {
					completionTime.value = Date.now() - startTime.value
					gameCompleted.value = true
				}
			}
		}
	}
}

const getShapeEmoji = (shapeName: string): string => {
	const emojiMap: { [key: string]: string } = {
		'circle': '⭕',
		'square': '⬜',
		'triangle': '🔺',
		'star': '⭐',
		'heart': '❤️',
		'diamond': '💎',
		'default': '🔷'
	}

	return emojiMap[shapeName.toLowerCase()] || emojiMap.default
}

const formatTime = (ms: number): string => {
	const seconds = Math.floor(ms / 1000)
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60
	return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

const resetGame = () => {
	detectedShapes.value.clear()
	shapePositions.value.clear()
	gridCells.value.forEach(cell => {
		cell.filled = false
		cell.active = false
		cell.shape = ''
	})
	gameCompleted.value = false
	startTime.value = Date.now()
	completionTime.value = 0
}

const goHome = () => {
	if (webcam) {
		webcam.stop()
	}
	router.push('/')
}

// Camera control functions


const flipCamera = async () => {
	try {
		if (webcam) {
			webcam.stop()
			if (webcam.canvas?.parentNode) {
				webcam.canvas.parentNode.removeChild(webcam.canvas)
			}
		}

		// Switch to next available camera
		currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length
		await initializeCamera()
	} catch (err) {
		console.error("Error flipping camera:", err)
	}
}

const toggleScreenFlip = () => {
	isScreenFlipped.value = !isScreenFlipped.value
}
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

.shape-icon {
	font-size: 2rem;
	filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.5));
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
	gap: 10px;
	align-items: center;
}

.detection-label {
	font-weight: bold;
}

.confidence {
	color: #ffd700;
	font-size: 0.9rem;
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
}

.modal-content h2 {
	color: #e20b1d;
	margin-bottom: 20px;
}

.modal-content p {
	margin-bottom: 15px;
	color: #333;
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

	.shape-icon {
		font-size: 1.5rem;
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
