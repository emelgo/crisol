/** Los enlaces externos: solo http, https y mailto. Lo demás (javascript:, data:…) ni se pega ni se pone */
export function isExternalUrl(url: string) {
  return /^(https?:\/\/[^\s]+|mailto:[^\s]+)$/i.test(url.trim())
}
