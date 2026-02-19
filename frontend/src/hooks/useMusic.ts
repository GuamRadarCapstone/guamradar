import { useEffect, useRef, useState } from "react";

const MUSIC_FILE = "Freddy.mp3";

export function useMusic() {
  const [musicOn, setMusicOn] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "") || "";
    const a = new Audio(`${base}/${MUSIC_FILE}`);
    a.loop = true;
    a.volume = 0.25;
    audioRef.current = a;
    return () => {
      a.pause();
      a.src = "";
    };
  }, []);

  async function toggleMusic() {
    const a = audioRef.current;
    if (!a) return;
    if (musicOn) {
      a.pause();
      setMusicOn(false);
    } else {
      try {
        await a.play();
        setMusicOn(true);
      } catch {
        // autoplay blocked until user interacts
      }
    }
  }

  return { musicOn, toggleMusic };
}
