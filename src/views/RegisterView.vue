<template>
	<div class="register-container">
		<div class="register-form">
			<MalibanLogo />
			<h1>Registration</h1>
			<button @click="showHowToPlay = true" class="how-to-play-btn" type="button">
				How to Play
			</button>
			<form @submit.prevent="handleSubmit">
				<div class="form-group">
					<label for="name">Full Name</label>
					<input id="name" v-model="form.name" type="text" placeholder="Enter your full name" required
						:class="{ error: errors.name }" />
					<span v-if="errors.name" class="error-message">{{ errors.name }}</span>
				</div>

				<div class="form-group">
					<label for="phone">Phone Number</label>
					<input id="phone" v-model="form.phone" type="tel" placeholder="0774395913" required
						:class="{ error: errors.phone }" />
					<span v-if="errors.phone" class="error-message">{{ errors.phone }}</span>
				</div>

				<button type="submit" :disabled="!isValid" class="submit-btn">
					{{ isLoading ? 'Registering...' : 'Start Scavenger Hunt' }}
				</button>
			</form>
		</div>

		<!-- How to Play Modal -->
		<div v-if="showHowToPlay" class="modal-overlay" @click="showHowToPlay = false">
			<div class="modal-content" @click.stop>
				<div class="modal-header">
					<h2>How to Play the Game</h2>
					<button @click="showHowToPlay = false" class="close-btn">&times;</button>
				</div>
				<div class="modal-body">
					<ol>
						<li>Register First</li>
						<li>Visit the Stalls – There are 6 stalls to explore:
							<ul>
								<li>Maliban - A50</li>
								<li>Non-Fat - L8</li>
								<li>Vitagen - L7</li>
								<li>Yahaposha - L6</li>
								<li>Maliban Tea - L5</li>
								<li>Zellers - A11, A12</li>
							</ul>
						</li>
						<li>Find the Hidden Clues – Each stall has one hidden clue.</li>
						<li>Use the Camera – After registering, you'll get access to the camera feature.</li>
						<li>Scan the Clues – Scan the hidden clues at each stall.</li>
						<li>Solve the Puzzle – Collect all 6 clues to complete the puzzle and stand a chance to win!</li>
					</ol>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import MalibanLogo from '../components/MalibanLogo.vue'

const router = useRouter()

// Modal state
const showHowToPlay = ref(false)

const form = ref({
	name: '',
	phone: ''
})

const errors = ref({
	name: '',
	phone: ''
})

const isLoading = ref(false)

// Phone validation for format like 0774395913
const validatePhone = (phone: string): boolean => {
	const phoneRegex = /^0[7-9]\d{8}$/
	return phoneRegex.test(phone.replace(/\s/g, ''))
}

const validateName = (name: string): boolean => {
	return name.trim().length >= 2
}

const isValid = computed(() => {
	return validateName(form.value.name) &&
		validatePhone(form.value.phone) &&
		!errors.value.name &&
		!errors.value.phone &&
		!isLoading.value
})

const validateForm = () => {
	errors.value.name = ''
	errors.value.phone = ''

	if (!validateName(form.value.name)) {
		errors.value.name = 'Name must be at least 2 characters long'
	}

	if (!validatePhone(form.value.phone)) {
		errors.value.phone = 'Please enter a valid phone number (e.g., 0774395913)'
	}
}

const handleSubmit = async () => {
	validateForm()

	if (isValid.value) {
		isLoading.value = true
		try {
			// Send registration data to Laravel API
			const response = await fetch('https://malibanscav.dev.artslabcreatives.com/api/participants', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: form.value.name,
					mobile: form.value.phone
				})
			})

			if (!response.ok) {
				throw new Error('Registration failed')
			}

			const participant = await response.json()
			console.log('Registration successful, participant:', participant)

			// Ensure we have a valid participant ID
			if (!participant.id) {
				throw new Error('Invalid participant data received')
			}

			// Store user data with participant ID in localStorage for the game
			localStorage.setItem('scavhunt_user', JSON.stringify({
				id: participant.id,
				name: form.value.name,
				phone: form.value.phone,
				registeredAt: new Date().toISOString()
			}))

			console.log('User data stored with participant ID:', participant.id)

			// Navigate to camera view
			router.push('/camera')
		} catch (error) {
			console.error('Registration error:', error)
			alert('Registration failed. Please try again.')
		} finally {
			isLoading.value = false
		}
	}
}

// Real-time validation
const handleNameInput = () => {
	if (form.value.name && !validateName(form.value.name)) {
		errors.value.name = 'Name must be at least 2 characters long'
	} else {
		errors.value.name = ''
	}
}

const handlePhoneInput = () => {
	if (form.value.phone && !validatePhone(form.value.phone)) {
		errors.value.phone = 'Please enter a valid phone number (e.g., 0774395913)'
	} else {
		errors.value.phone = ''
	}
}
</script>

<style scoped>
.register-container {
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 100vh;
	max-height: 100vh;
	background: url('/public/bg.png') no-repeat center center fixed;
	background-size: cover;
	padding: 20px;
	overflow: hidden;
	box-sizing: border-box;
}

.register-form {
	background: white;
	padding: 40px;
	border-radius: 16px;
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
	width: 100%;
	max-width: 400px;
	border: 3px solid #e20b1d;
}

h1 {
	text-align: center;
	color: #113c66;
	margin-bottom: 30px;
	font-size: 2rem;
	font-weight: bold;
}

.how-to-play-btn {
	width: 100%;
	padding: 12px;
	background: #113c66;
	color: white;
	border: none;
	border-radius: 8px;
	font-size: 14px;
	font-weight: 600;
	cursor: pointer;
	margin-bottom: 20px;
	transition: background-color 0.3s ease, transform 0.2s ease;
}

.how-to-play-btn:hover {
	background: #0d2f52;
	transform: translateY(-1px);
}

.modal-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 1000;
	padding: 20px;
}

.modal-content {
	background: white;
	border-radius: 12px;
	max-width: 500px;
	width: 100%;
	max-height: 80vh;
	overflow-y: auto;
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.modal-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 20px;
	border-bottom: 1px solid #e1e5e9;
}

.modal-header h2 {
	margin: 0;
	color: #113c66;
	font-size: 1.5rem;
}

.close-btn {
	background: none;
	border: none;
	font-size: 24px;
	cursor: pointer;
	color: #666;
	padding: 0;
	width: 30px;
	height: 30px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.close-btn:hover {
	color: #e20b1d;
}

.modal-body {
	padding: 20px;
}

.modal-body ol {
	margin: 0;
	padding-left: 20px;
	color: #333;
}

.modal-body li {
	margin-bottom: 12px;
	line-height: 1.5;
}

.modal-body ul {
	margin: 8px 0;
	padding-left: 20px;
}

.modal-body ul li {
	margin-bottom: 4px;
}

.form-group {
	margin-bottom: 20px;
}

label {
	display: block;
	margin-bottom: 8px;
	color: #113c66;
	font-weight: 600;
}

input {
	width: 100%;
	padding: 12px 16px;
	border: 2px solid #e1e5e9;
	border-radius: 8px;
	font-size: 16px;
	transition: border-color 0.3s ease;
	box-sizing: border-box;
}

input:focus {
	outline: none;
	border-color: #e20b1d;
}

input.error {
	border-color: #e74c3c;
}

.error-message {
	color: #e74c3c;
	font-size: 14px;
	margin-top: 5px;
	display: block;
}

.submit-btn {
	width: 100%;
	padding: 14px;
	background: #e20b1d;
	color: white;
	border: none;
	border-radius: 8px;
	font-size: 16px;
	font-weight: 600;
	cursor: pointer;
	transition: opacity 0.3s ease, transform 0.2s ease;
}

.submit-btn:hover:not(:disabled) {
	transform: translateY(-2px);
	box-shadow: 0 5px 15px rgba(226, 11, 29, 0.4);
	background: #cc0918;
}

.submit-btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
	transform: none;
}

@media (max-width: 480px) {
	.register-container {
		padding: 10px;
		align-items: flex-start;
		padding-top: 5vh;
	}

	.register-form {
		padding: 20px 15px;
		max-height: 90vh;
		overflow-y: auto;
	}

	h1 {
		font-size: 1.5rem;
		margin-bottom: 20px;
	}

	input {
		padding: 10px 12px;
		font-size: 16px;
		/* Prevents zoom on iOS */
	}

	.submit-btn {
		padding: 12px;
		font-size: 16px;
	}

	.modal-overlay {
		padding: 10px;
	}

	.modal-content {
		max-height: 90vh;
	}

	.modal-header {
		padding: 15px;
	}

	.modal-header h2 {
		font-size: 1.2rem;
	}

	.modal-body {
		padding: 15px;
	}

	.how-to-play-btn {
		padding: 10px;
		font-size: 14px;
	}
}
</style>
