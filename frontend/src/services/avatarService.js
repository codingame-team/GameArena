import axios from 'axios'
import API_BASE_URL from '../config'

export const AVAILABLE_AVATARS = [
  { id: 'my_bot', name: 'Robot', file: 'my_bot.svg' },
  { id: 'boss', name: 'Boss', file: 'boss.svg' },
  { id: 'ninja', name: 'Ninja', file: 'ninja.svg' },
  { id: 'warrior', name: 'Guerrier', file: 'warrior.svg' },
  { id: 'wizard', name: 'Magicien', file: 'wizard.svg' },
  { id: 'knight', name: 'Chevalier', file: 'knight.svg' },
  { id: 'archer', name: 'Archer', file: 'archer.svg' },
  { id: 'alien', name: 'Alien', file: 'alien.svg' },
]

class AvatarService {
  constructor() {
    this.blobUrls = new Set()
  }

  async getCurrentAvatar() {
    const res = await axios.get(`${API_BASE_URL}/api/user/avatar`)
    return res.data
  }

  async getAvatarImage() {
    const res = await axios.get(`${API_BASE_URL}/api/user/avatar/image`, {
      responseType: 'blob'
    })
    return res.data
  }

  async saveAvatar(avatarId) {
    await axios.post(`${API_BASE_URL}/api/user/avatar`, { avatar: avatarId })
  }

  async uploadAvatar(file) {
    const formData = new FormData()
    formData.append('avatar', file)
    await axios.post(`${API_BASE_URL}/api/user/avatar/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  }

  createBlobUrl(blob) {
    const url = URL.createObjectURL(blob)
    this.blobUrls.add(url)
    return url
  }

  revokeBlobUrl(url) {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
      this.blobUrls.delete(url)
    }
  }

  revokeAllBlobUrls() {
    this.blobUrls.forEach(url => URL.revokeObjectURL(url))
    this.blobUrls.clear()
  }

  getAvatarUrl(avatarId, customUrl = null) {
    if (avatarId === 'custom_upload' && customUrl) return customUrl
    if (avatarId?.startsWith('custom_')) return `${API_BASE_URL}/api/user/avatar/image`
    const avatar = AVAILABLE_AVATARS.find(a => a.id === avatarId)
    return `/avatars/${avatar?.file || 'my_bot.svg'}`
  }

  validateFile(file) {
    if (!file.type.startsWith('image/')) {
      throw new Error('Veuillez sélectionner une image (PNG, JPG, GIF, etc.)')
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('L\'image est trop grande (max 2MB)')
    }
  }
}

export default new AvatarService()
