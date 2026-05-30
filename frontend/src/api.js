import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000' })

export const getAccounts = () => api.get('/accounts').then(r => r.data)
export const getAccount = (id) => api.get(`/accounts/${id}`).then(r => r.data)
export const getHealthSummary = () => api.get('/health/summary').then(r => r.data)
export const getChurnSignals = () => api.get('/signals/churn').then(r => r.data)
export const getExpansionSignals = () => api.get('/signals/expansion').then(r => r.data)
export const runChurnDetection = () => api.post('/signals/churn/run').then(r => r.data)
export const runExpansionDetection = () => api.post('/signals/expansion/run').then(r => r.data)