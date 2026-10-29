import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { Injectable } from '@angular/core';

/** What the lobby decided, handed on to the call (L2-040): which devices to use, and whether to leave the camera out. */
@Injectable({ providedIn: 'root' })
export class CallDevices {
  cameraId: string | null = null;
  microphoneId: string | null = null;
  audioOnly = false;
}

/** Why the camera is unavailable, so the lobby can tell a blocked browser from a missing device. */
export type CameraState = 'ready' | 'blocked' | 'missing';

export interface LocalMedia {
  stream: MediaStream | null;
  camera: CameraState;
}

/** Opens the microphone and, unless `audioOnly`, the camera; a refused camera falls back to audio alone. */
export async function openLocalMedia(devices: CallDevices): Promise<LocalMedia> {
  const media = navigator.mediaDevices;
  if (!media?.getUserMedia) return { stream: null, camera: 'missing' };
  const audio: MediaTrackConstraints | boolean = devices.microphoneId
    ? { deviceId: { exact: devices.microphoneId } }
    : true;
  const video: MediaTrackConstraints | boolean = devices.cameraId
    ? { deviceId: { exact: devices.cameraId } }
    : true;
  if (!devices.audioOnly) {
    try {
      return { stream: await media.getUserMedia({ audio, video }), camera: 'ready' };
    } catch (e) {
      const camera = (e as DOMException).name === 'NotAllowedError' ? 'blocked' : 'missing';
      return { stream: await audioOnly(audio), camera };
    }
  }
  return { stream: await audioOnly(audio), camera: 'blocked' };
}

async function audioOnly(audio: MediaTrackConstraints | boolean): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio, video: false });
  } catch {
    return null;
  }
}

export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Plays a media stream in the `<video>` it sits on. */
@Directive({
  selector: 'video[slStream]',
  host: { autoplay: '', playsinline: '' },
})
export class StreamVideo {
  readonly slStream = input<MediaStream | null>(null);
  private readonly el = inject<ElementRef<HTMLVideoElement>>(ElementRef);

  constructor() {
    effect(() => {
      const stream = this.slStream();
      const video = this.el.nativeElement;
      if (video.srcObject !== stream) video.srcObject = stream;
      if (stream) void video.play().catch(() => undefined);
    });
  }
}
