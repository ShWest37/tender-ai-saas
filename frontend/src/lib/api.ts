import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Интерцептор: добавляем токен
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Интерцептор: обрабатываем 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        const path = window.location.pathname
        // Страница входа сама показывает ошибку — не перезагружаем её
        if (path !== '/auth/login' && path !== '/admin/login') {
          // В админке — страница авторизации администратора, в ЛК — общая
          window.location.href = path.startsWith('/admin') ? '/admin/login' : '/auth/login'
        }
      }
    }
    // Демо-период/подписка закончились: сообщаем кабинету, чтобы показать тарифы
    if (error.response?.status === 402) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('subscription:expired'))
      }
    }
    return Promise.reject(error)
  }
)