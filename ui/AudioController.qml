import QtQuick
import QtMultimedia
import "../logic/audio.mjs" as AudioLogic

Item {
  id: audio

  property real musicVolume: 0.6
  property real soundVolume: 0.8
  property bool muted: false
  property bool musicRunning: false
  property string track: ""

  function play(name) {
    if (muted || soundVolume <= 0) return
    const sound = sounds.objectAt(AudioLogic.SOUNDS.indexOf(name))
    if (sound) sound.play()
  }

  function startTrack(name) {
    player.stop()
    track = name
    updateMusic()
  }

  function updateMusic() {
    if (musicRunning && track !== "") player.play()
    else player.pause()
  }

  onMusicRunningChanged: updateMusic()

  AudioOutput {
    id: output
    volume: audio.muted ? 0 : audio.musicVolume
  }

  MediaPlayer {
    id: player
    source: audio.track === "" ? "" : Qt.resolvedUrl("../assets/audio/music/" + audio.track + ".ogg")
    audioOutput: output
    loops: MediaPlayer.Infinite
  }

  Instantiator {
    id: sounds
    model: AudioLogic.SOUNDS

    SoundEffect {
      required property string modelData
      source: Qt.resolvedUrl("../assets/audio/sfx/" + modelData + ".wav")
      volume: audio.soundVolume * AudioLogic.SOUND_GAINS[modelData]
      muted: audio.muted
    }
  }
}
