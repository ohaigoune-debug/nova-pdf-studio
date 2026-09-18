/** `npm run push:keys` — يطبع زوج مفاتيح VAPID لوضعهما في البيئة */
import { generateVapidKeys } from './web-push'

const k = generateVapidKeys()
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${k.privateKey}`)
console.log('VAPID_SUBJECT=mailto:admin@example.com')
