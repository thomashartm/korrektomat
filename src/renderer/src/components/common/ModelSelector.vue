<script setup lang="ts">
import { MODEL_PRESETS } from '../../stores/settings.store'

defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [key: string]
}>()

function providerLabel(provider: string): string {
  return provider === 'anthropic' ? 'Anthropic' : 'Google'
}
</script>

<template>
  <div class="model-grid">
    <div
      v-for="(config, key) in MODEL_PRESETS"
      :key="key"
      class="model-card"
      :class="{ selected: modelValue === key }"
      @click="emit('update:modelValue', key as string)"
    >
      <div class="model-provider">{{ providerLabel(config.provider) }}</div>
      <div class="model-name">{{ key }}</div>
      <div class="model-id">{{ config.model }}</div>
    </div>
  </div>
</template>

<style scoped>
.model-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.model-card {
  background: #1a1a2e;
  border: 2px solid #2a2a4a;
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.model-card:hover {
  border-color: #4a90d9;
}

.model-card.selected {
  border-color: #c00000;
  background: #1a1020;
}

.model-provider {
  font-size: 11px;
  color: #6a6a8a;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.model-name {
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 2px;
}

.model-id {
  font-size: 11px;
  color: #4a4a6a;
  font-family: 'JetBrains Mono', monospace;
}
</style>
