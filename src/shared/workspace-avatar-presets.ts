export const WORKSPACE_AVATAR_PRESETS = [
  { id: 'fern', label: 'Fern', src: '/workspace-avatars/fern.svg' },
  { id: 'coral', label: 'Coral', src: '/workspace-avatars/coral.svg' },
  { id: 'sky', label: 'Sky', src: '/workspace-avatars/sky.svg' },
  { id: 'amber', label: 'Amber', src: '/workspace-avatars/amber.svg' },
  { id: 'lilac', label: 'Lilac', src: '/workspace-avatars/lilac.svg' },
  { id: 'ocean', label: 'Ocean', src: '/workspace-avatars/ocean.svg' },
] as const;

export type WorkspaceAvatarPresetId = typeof WORKSPACE_AVATAR_PRESETS[number]['id'];
export const WORKSPACE_AVATAR_PREFIX = 'preset:';

export function workspaceAvatarPresetKey(id: WorkspaceAvatarPresetId) {
  return `${WORKSPACE_AVATAR_PREFIX}${id}`;
}

export function getWorkspaceAvatarPreset(id: string | null | undefined) {
  return WORKSPACE_AVATAR_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function getDefaultWorkspaceAvatarId(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  return WORKSPACE_AVATAR_PRESETS[hash % WORKSPACE_AVATAR_PRESETS.length]!.id;
}

export function getWorkspaceAvatarPresetFromKey(key: string | null | undefined) {
  if (!key?.startsWith(WORKSPACE_AVATAR_PREFIX)) return null;
  return getWorkspaceAvatarPreset(key.slice(WORKSPACE_AVATAR_PREFIX.length));
}
