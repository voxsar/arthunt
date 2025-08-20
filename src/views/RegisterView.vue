<template>
	<div class="register-container">
		<div class="register-form">
			
			<h1>Maliban Puzzle Hunt Registration</h1>
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
					Start Scavenger Hunt
				</button>
			</form>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const form = ref({
	name: '',
	phone: ''
})

const errors = ref({
	name: '',
	phone: ''
})

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
		!errors.value.phone
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

const handleSubmit = () => {
	validateForm()

	if (isValid.value) {
		// Store user data in localStorage for the game
		localStorage.setItem('scavhunt_user', JSON.stringify({
			name: form.value.name,
			phone: form.value.phone,
			registeredAt: new Date().toISOString()
		}))

		// Navigate to camera view
		router.push('/camera')
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
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
}

h1 {
	text-align: center;
	color: #333;
	margin-bottom: 30px;
	font-size: 2rem;
}

.form-group {
	margin-bottom: 20px;
}

label {
	display: block;
	margin-bottom: 8px;
	color: #555;
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
	border-color: #667eea;
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
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
	box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
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
}
</style>
