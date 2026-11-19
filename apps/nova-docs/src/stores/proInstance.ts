import { NovaStore } from '../platform/native'
import { createProStore } from './pro'

export const usePro = createProStore(NovaStore)
