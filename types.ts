export type RecordingState = 'idle' | 'recording' | 'paused' | 'finished' | 'error';

export interface Resolution { label: string; width: number; height: number; }
export interface FrameRate { label: string; value: number; }
export interface Bitrate { label: string; value: number; }
export interface WebcamSize { label: string; scale: number; }

export type WebcamPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | { x: number; y: number };
export type WebcamShape = 'rectangle' | 'rounded-square' | 'circle' | 'ellipse';

export type AnnotationTool = 'pen';
export interface AnnotationPoint { x: number; y: number; }
export interface AnnotationPath {
    points: AnnotationPoint[];
    color: string;
    thickness: number;
}

export interface Settings {
    resolution: Resolution;
    frameRate: FrameRate;
    bitrate: Bitrate;
    audioSource: string; // deviceId or 'default'
    includeSystemAudio: boolean;
    webcamEnabled: boolean;
    webcamSize: WebcamSize;
    webcamPosition: WebcamPosition;
    webcamShape: WebcamShape;
    webcamBorder: boolean;
    webcamShadow: boolean;
    webcamBackground: 'none' | 'blur' | 'image';
    webcamBackgroundImage: string | null;
}

export interface AudioSource { id: string; label: string; }