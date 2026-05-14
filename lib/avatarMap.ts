export const avatarMap: Record<string, string> = {
  capybara: '/avatars/capybara.png',
  panda: '/avatars/panda.png',
  penguin: '/avatars/penguin.png',
  cat: '/avatars/cat.png',
}

export const getAvatarSrc = (avatar?: string) => {
  if (!avatar) return '/avatars/capybara.png'
  return avatarMap[avatar] || '/avatars/capybara.png'
}
