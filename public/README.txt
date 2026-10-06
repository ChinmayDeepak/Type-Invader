Drop your background track here as music.mp3.

The game degrades gracefully without it: the audio element fires an error,
MUS.failed is set, and the music toggle in Settings shows "music.mp3 not found".
Everything else - sound effects, gameplay - is generated with the Web Audio API
and needs no files.
