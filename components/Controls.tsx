
import React, { useState, useEffect, useRef } from 'react';
import { RecordingState, WebcamPosition, AnnotationTool } from '../types';
import { Camera, Pause, Play, Square, Video, VideoOff, Pen, Undo, Trash2 } from 'lucide-react';
import { ANNOTATION_COLORS, ANNOTATION_THICKNESSES } from '../constants';

interface ControlsProps {
    recordingState: RecordingState; onStart: () => void; onStop: () => void; onPauseResume: () => void;
    onToggleWebcam: () => void; isWebcamEnabled: boolean; isWebcamVisible: boolean; isPreparing: boolean;
    annotationTool: AnnotationTool; onAnnotationToolChange: (tool: AnnotationTool) => void;
    annotationColor: string; onAnnotationColorChange: (color: string) => void;
    annotationThickness: number; onAnnotationThicknessChange: (thickness: number) => void;
    onUndo: () => void; onClear: () => void;
}
const Timer: React.FC<{ recordingState: RecordingState }> = ({ recordingState }) => {
    const [seconds, setSeconds] = useState(0);
    const intervalRef = useRef<number | null>(null);
    useEffect(() => {
        if (recordingState === 'recording') {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = window.setInterval(() => setSeconds(s => s + 1), 1000);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (recordingState === 'idle' || recordingState === 'finished') setSeconds(0);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [recordingState]);
    
    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    return <div className="text-lg font-mono bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2 rounded-md w-28 text-center">{formatTime(seconds)}</div>;
};
const AnnotationToolbar: React.FC<Pick<ControlsProps, 'annotationColor' | 'onAnnotationColorChange' | 'annotationThickness' | 'onAnnotationThicknessChange' | 'onUndo' | 'onClear'>> = 
    ({ annotationColor, onAnnotationColorChange, annotationThickness, onAnnotationThicknessChange, onUndo, onClear }) => (
    <div className="flex items-center space-x-2 p-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg">
        <Pen size={20} className="text-cyan-500 mx-2" />
        {ANNOTATION_COLORS.map(color => (
            <button key={color.value} onClick={() => onAnnotationColorChange(color.value)} className={`w-6 h-6 rounded-full transition-transform transform hover:scale-110 ${annotationColor === color.value ? 'ring-2 ring-offset-2 ring-offset-slate-200 dark:ring-offset-slate-700 ring-cyan-500' : ''}`} style={{ backgroundColor: color.value }} title={color.label} />
        ))}
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>
        {ANNOTATION_THICKNESSES.map(t => (
            <button key={t.value} onClick={() => onAnnotationThicknessChange(t.value)} className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${annotationThickness === t.value ? 'bg-cyan-500 text-white' : 'hover:bg-slate-300 dark:hover:bg-slate-600'}`} title={`${t.label} thickness`}>
                <div className="bg-current rounded-full" style={{ width: t.value + 2, height: t.value + 2 }}></div>
            </button>
        ))}
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1"></div>
        <button onClick={onUndo} title="Undo" className="p-2 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full"><Undo size={18} /></button>
        <button onClick={onClear} title="Clear All" className="p-2 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-full"><Trash2 size={18} /></button>
    </div>
);
const Controls: React.FC<ControlsProps> = ({ recordingState, onStart, onStop, onPauseResume, onToggleWebcam, isWebcamEnabled, isWebcamVisible, isPreparing, ...annotationProps }) => {
    const isRecordingActive = recordingState === 'recording' || recordingState === 'paused';
    return (
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg shadow-lg flex items-center justify-between space-x-4 h-[72px]">
            <div className="flex-1 flex justify-start">{isRecordingActive ? <Timer recordingState={recordingState} /> : <div className="w-28"></div>}</div>
            <div className="flex-1 flex justify-center">
                {recordingState === 'idle' && <button onClick={onStart} disabled={isPreparing} className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-wait"><Video size={20} /><span>{isPreparing ? 'Preparing...' : 'Start Recording'}</span></button>}
                {isRecordingActive && <AnnotationToolbar {...annotationProps} />}
                {recordingState === 'finished' && <div className="text-lg text-green-600 dark:text-green-400 font-semibold">Recording Finished!</div>}
            </div>
            <div className="flex-1 flex justify-end items-center space-x-3">
                {isRecordingActive && (
                    <>
                        <button onClick={onPauseResume} title={recordingState === 'recording' ? 'Pause' : 'Resume'} className="p-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full">
                            {recordingState === 'recording' ? <Pause size={24} /> : <Play size={24} />}
                        </button>
                        <button onClick={onStop} title="Stop" className="p-3 bg-slate-500 hover:bg-slate-600 text-white rounded-full"><Square size={24} /></button>
                        {isWebcamEnabled && 
                            <button onClick={onToggleWebcam} title={isWebcamVisible ? "Hide Webcam" : "Show Webcam"} className={`p-3 rounded-full ${isWebcamVisible ? 'bg-cyan-500' : 'bg-slate-400'}`}>
                                {isWebcamVisible ? <Camera size={20} /> : <VideoOff size={20} />}
                            </button>
                        }
                    </>
                )}
            </div>
        </div>
    );
};
export default Controls;
