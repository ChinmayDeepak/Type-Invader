// One shared element survives React route changes (including sign-in).
let audio;
let unlocked = false;
let wanted = true;
let enabled = true;
let volume = 0.45;

function track() {
  if (!audio) {
    audio = new Audio(`${import.meta.env.BASE_URL}lobbyend.mp3`);
    audio.loop = true;
    audio.preload = "auto";
  }
  return audio;
}
function sync() {
  if (!unlocked) return;
  const song = track();
  song.volume = volume;
  if (wanted && enabled && volume > 0) {
    // Missing files or browser playback rejection must not block entry.
    song.play().catch(() => {});
  } else {
    song.pause();
  }
}
export function unlockLobbyMusic() {
  unlocked = true;
  sync(); // Called synchronously inside the opening user gesture.
}
export function startLobbyMusic() {
  // Restart only after a run/exit, never on normal lobby navigation.
  if (!wanted && audio) audio.currentTime = 0;
  wanted = true;
  sync();
}
export function stopLobbyMusic() {
  wanted = false;
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}
export function configureLobbyMusic(on, percent) {
  enabled = !!on;
  volume = Math.max(0, Math.min(100, percent)) / 100;
  sync();
}
