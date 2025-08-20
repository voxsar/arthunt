<template>
	<div class="maliban-logo">
		<img src="/logo_150h.png" alt="Maliban Logo" style="margin: 20px;" />
	</div>
</template>

<script setup lang="ts">
// No props needed for this simple logo
</script>

<style scoped>
.maliban-logo {
	display: flex;
	justify-content: center;
	align-items: center;
	margin-bottom: 20px;
}

.maliban-logo img {
	width: 100%;
	max-width: 300px;
	height: auto;
}

/* When used in header */
.maliban-logo.header-logo {
	margin-bottom: 0;
}

.maliban-logo.header-logo img {
	max-width: 200px;
	height: 40px;
}

@media (max-width: 480px) {
	.maliban-logo img {
		max-width: 250px;
	}

	.maliban-logo.header-logo img {
		max-width: 150px;
		height: 30px;
	}
}
</style>
