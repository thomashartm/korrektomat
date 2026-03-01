import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/DashboardView.vue')
    },
    {
      path: '/runs/:slug',
      name: 'run',
      component: () => import('../views/RunView.vue'),
      props: true
    },
    {
      path: '/runs/:slug/students/:studentSlug',
      name: 'student',
      component: () => import('../views/StudentView.vue'),
      props: true
    },
    {
      path: '/runs/:slug/grading',
      name: 'grading',
      component: () => import('../views/GradingView.vue'),
      props: true
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    }
  ]
})

export default router
