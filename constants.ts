import { Resolution, FrameRate, Bitrate, WebcamSize, WebcamShape } from './types';

export const RESOLUTIONS: Resolution[] = [
    { label: '720p', width: 1280, height: 720 },
    { label: '1080p', width: 1920, height: 1080 },
    { label: '1440p', width: 2560, height: 1440 },
];

export const FRAME_RATES: FrameRate[] = [
    { label: '30 fps', value: 30 },
    { label: '60 fps', value: 60 },
];

export const BITRATES: Bitrate[] = [
    { label: 'Low', value: 1_000_000 },
    { label: 'Medium', value: 2_500_000 },
    { label: 'High', value: 5_000_000 },
];

export const WEBCAM_SIZES: WebcamSize[] = [
    { label: 'Small', scale: 0.15 },
    { label: 'Medium', scale: 0.25 },
    { label: 'Large', scale: 0.35 },
];

export const WEBCAM_SHAPES: { label: string, value: WebcamShape }[] = [
    { label: 'Rectangle', value: 'rectangle' },
    { label: 'Rounded Square', value: 'rounded-square' },
    { label: 'Circle', value: 'circle' },
    { label: 'Ellipse', value: 'ellipse' },
];

export const ANNOTATION_COLORS = [
    { label: 'Red', value: '#ef4444' },
    { label: 'Blue', value: '#3b82f6' },
    { label: 'Green', value: '#22c55e' },
    { label: 'Yellow', value: '#eab308' },
    { label: 'White', value: '#ffffff' },
];

export const ANNOTATION_THICKNESSES = [
    { label: 'Thin', value: 2 },
    { label: 'Medium', value: 5 },
    { label: 'Thick', value: 10 },
];