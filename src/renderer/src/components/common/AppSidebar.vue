<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const navItems = [
  { name: 'dashboard', label: 'Dashboard', icon: '&#9776;', path: '/' },
  { name: 'settings', label: 'Einstellungen', icon: '&#9881;', path: '/settings' }
]

const isActive = (name: string): boolean => {
  if (name === 'dashboard') {
    return route.name === 'dashboard' || route.name === 'run' || route.name === 'student' || route.name === 'grading'
  }
  return route.name === name
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <div class="logo-container">
        <div class="logo-icon">K</div>
        <div class="logo-text">
          <span class="logo-title">Korrektomat</span>
          <span class="logo-subtitle">v1.0</span>
        </div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="item.path"
        class="nav-item"
        :class="{ active: isActive(item.name) }"
      >
        <span class="nav-icon" v-html="item.icon"></span>
        <span class="nav-label">{{ item.label }}</span>
      </router-link>
    </nav>

    <div class="sidebar-footer">
      <div class="status-indicator">
        <span class="status-dot"></span>
        <span class="status-text">Bereit</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  background: #1a1a2e;
  border-right: 1px solid #2a2a4a;
  display: flex;
  flex-direction: column;
  -webkit-app-region: drag;
}

.sidebar-header {
  padding: 20px 16px;
  border-bottom: 1px solid #2a2a4a;
}

.logo-container {
  display: flex;
  align-items: center;
  gap: 10px;
  -webkit-app-region: no-drag;
}

.logo-icon {
  width: 36px;
  height: 36px;
  background: #c00000;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 18px;
  color: white;
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-title {
  font-weight: 700;
  font-size: 15px;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.logo-subtitle {
  font-size: 11px;
  color: #6a6a8a;
}

.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: #8a8aaa;
  font-size: 14px;
  transition: all 0.15s ease;
  cursor: pointer;
}

.nav-item:hover {
  background: #2a2a4a;
  color: #c0c0e0;
}

.nav-item.active {
  background: #c00000;
  color: white;
}

.nav-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #2a2a4a;
  -webkit-app-region: no-drag;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #196f2b;
}

.status-text {
  font-size: 12px;
  color: #6a6a8a;
}
</style>
