
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { RecordingState, Settings, WebcamPosition, AudioSource, AnnotationTool, AnnotationPath } from './types';
import { RESOLUTIONS, FRAME_RATES, BITRATES, WEBCAM_SIZES, ANNOTATION_COLORS, ANNOTATION_THICKNESSES } from './constants';
import SettingsPanel from './components/SettingsPanel';
import Controls from './components/Controls';
import VideoPreview from './components/VideoPreview';
import Countdown from './components/Countdown';
import { Moon, Sun } from 'lucide-react';
import { openDB, DBSchema } from 'idb';

type Theme = 'light' | 'dark';
type Transcript = { text: string; error: string | null };

interface RecordingChunk {
    id: number;
    chunk: Blob;
    timestamp: number;
}
interface LiveCapDB extends DBSchema {
    'recording-chunks': {
        key: number;
        value: RecordingChunk;
    };
}
const dbPromise = openDB<LiveCapDB>('LiveCapDB', 1, {
    upgrade(db) {
        db.createObjectStore('recording-chunks', { keyPath: 'id', autoIncrement: true });
    },
});

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            resolve(base64data.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};


const App: React.FC = () => {
    const [settings, setSettings] = useState<Settings>({
        resolution: RESOLUTIONS[0], // 720p default
        frameRate: FRAME_RATES[0], // 30fps default
        bitrate: BITRATES[1], // Medium
        audioSource: 'default',
        includeSystemAudio: false,
        webcamEnabled: true,
        webcamSize: WEBCAM_SIZES[1], // Medium
        webcamPosition: 'bottom-right',
        // Fix: Changed 'rounded-rectangle' to a valid WebcamShape type 'rounded-square'.
        webcamShape: 'rounded-square',
        webcamBorder: true,
        webcamShadow: true,
        webcamBackground: 'none',
        webcamBackgroundImage: null,
    });
    const [recordingState, setRecordingState] = useState<RecordingState>('idle');
    const [audioSources, setAudioSources] = useState<AudioSource[]>([]);
    const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
    const [isCountingDown, setIsCountingDown] = useState(false);
    const [isPreparing, setIsPreparing] = useState(false);
    const [isWebcamVisible, setIsWebcamVisible] = useState(true);
    const [isCanvasReady, setIsCanvasReady] = useState(false);
    const [countdownFinished, setCountdownFinished] = useState(false);
    const [theme, setTheme] = useState<Theme>('dark');
    const [transcript, setTranscript] = useState<Transcript>({ text: '', error: null });
    const [isTranscribing, setIsTranscribing] = useState(false);
    // Annotation state
    const [annotationTool, setAnnotationTool] = useState<AnnotationTool>('pen');
    const [annotationColor, setAnnotationColor] = useState(ANNOTATION_COLORS[0].value);
    const [annotationThickness, setAnnotationThickness] = useState(ANNOTATION_THICKNESSES[1].value);
    const [annotationPaths, setAnnotationPaths] = useState<AnnotationPath[]>([]);
    const annotationHistory = useRef<AnnotationPath[]>([]);

    const screenStreamRef = useRef<MediaStream | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const webcamStreamRef = useRef<MediaStream | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Load settings and theme from localStorage
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem('liveCapSettings');
            if (savedSettings) setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings)}));
            const savedTheme = localStorage.getItem('liveCapTheme') as Theme;
            if (savedTheme) setTheme(savedTheme);
            else setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        } catch (error) { console.error("Failed to load settings", error); }
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('liveCapSettings', JSON.stringify(settings));
        } catch (error) { console.error("Failed to save settings", error); }
    }, [settings]);

    useEffect(() => {
        try {
            localStorage.setItem('liveCapTheme', theme);
            document.documentElement.classList.toggle('dark', theme === 'dark');
        } catch (error) { console.error("Failed to save theme", error); }
    }, [theme]);

    const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

    useEffect(() => {
        const getAudioDevices = async () => {
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                setAudioSources(devices.filter(d => d.kind === 'audioinput').map(d => ({ id: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 6)}` })));
            } catch (err) { console.error('Error enumerating audio devices:', err); }
        };
        getAudioDevices();
    }, []);

    const stopAllStreams = useCallback(() => {
        [screenStreamRef, micStreamRef, webcamStreamRef].forEach(ref => {
            ref.current?.getTracks().forEach(track => track.stop());
            ref.current = null;
        });
    }, []);

    const clearRecordingChunks = async () => {
        const db = await dbPromise;
        await db.clear('recording-chunks');
    };

    const actuallyStartRecorder = useCallback(async () => {
        if (!screenStreamRef.current || !canvasRef.current) return;

        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        if (micStreamRef.current) audioContext.createMediaStreamSource(micStreamRef.current).connect(destination);
        if (screenStreamRef.current.getAudioTracks().length > 0) audioContext.createMediaStreamSource(screenStreamRef.current).connect(destination);
        
        const canvasStream = canvasRef.current.captureStream(settings.frameRate.value);
        const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);

        await clearRecordingChunks();

        mediaRecorderRef.current = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9', videoBitsPerSecond: settings.bitrate.value });
        
        mediaRecorderRef.current.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                const db = await dbPromise;
                await db.add('recording-chunks', { chunk: event.data, timestamp: Date.now() });
            }
        };

        mediaRecorderRef.current.onstop = async () => {
            const db = await dbPromise;
            const allChunks = await db.getAll('recording-chunks');
            const sortedBlobs = allChunks.sort((a, b) => a.timestamp - b.timestamp).map(c => c.chunk);
            const blob = new Blob(sortedBlobs, { type: 'video/webm' });
            setRecordedVideoUrl(URL.createObjectURL(blob));
            setRecordingState('finished');
            stopAllStreams();
            mediaRecorderRef.current = null;
            await clearRecordingChunks();
        };

        mediaRecorderRef.current.start(10000); // Save chunks every 10s
        setRecordingState('recording');
        setIsCountingDown(false);
    }, [settings, stopAllStreams]);

    useEffect(() => {
        if (isCountingDown && isCanvasReady && countdownFinished && recordingState === 'idle') {
            actuallyStartRecorder();
        }
    }, [isCountingDown, isCanvasReady, countdownFinished, recordingState, actuallyStartRecorder]);

    const startRecording = useCallback(async () => {
        if (isPreparing || isCountingDown || recordingState !== 'idle') return;
        setRecordedVideoUrl(null);
        setTranscript({ text: '', error: null });
        setAnnotationPaths([]);
        annotationHistory.current = [];
        setIsCanvasReady(false);
        setCountdownFinished(false);
        setIsPreparing(true);
        try {
            screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({ video: { ...settings.resolution, frameRate: settings.frameRate.value }, audio: settings.includeSystemAudio });
            screenStreamRef.current.getTracks()[0].onended = stopRecording;
            if (settings.webcamEnabled) webcamStreamRef.current = await navigator.mediaDevices.getUserMedia({ video: true });
            micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: settings.audioSource === 'default' ? undefined : { exact: settings.audioSource } } });
            setIsPreparing(false);
            setIsCountingDown(true);
        } catch (err) {
            console.error('Error starting recording:', err);
            alert("Failed to start recording. Please check permissions.");
            stopAllStreams();
            setIsPreparing(false);
        }
    }, [settings, isPreparing, isCountingDown, recordingState, stopAllStreams]);
    
    const stopRecording = () => {
        if (mediaRecorderRef.current && recordingState !== 'idle' && recordingState !== 'finished') mediaRecorderRef.current.stop();
        else {
            stopAllStreams();
            setRecordingState('idle');
            setIsCountingDown(false);
        }
    };
    
    const pauseResumeRecording = () => {
        if (!mediaRecorderRef.current) return;
        if (recordingState === 'recording') { mediaRecorderRef.current.pause(); setRecordingState('paused'); }
        else if (recordingState === 'paused') { mediaRecorderRef.current.resume(); setRecordingState('recording'); }
    };

    const toggleWebcamVisibility = () => {
        if (recordingState === 'recording' || recordingState === 'paused') setIsWebcamVisible(prev => !prev);
    };

    const handleUndoAnnotation = () => {
        if (annotationPaths.length === 0) return;
        const lastPath = annotationPaths[annotationPaths.length - 1];
        annotationHistory.current.push(lastPath);
        setAnnotationPaths(annotationPaths.slice(0, -1));
    };
    const handleClearAnnotations = () => {
        annotationHistory.current.push(...annotationPaths);
        setAnnotationPaths([]);
    };

    const handleCanvasReady = useCallback(() => setIsCanvasReady(true), []);
    const handleCountdownFinish = useCallback(() => setCountdownFinished(true), []);

    const applyLowCpuPreset = () => setSettings(prev => ({ ...prev, resolution: RESOLUTIONS[0], frameRate: FRAME_RATES[0], bitrate: BITRATES[0] }));

    const handleGenerateTranscript = async () => {
        if (!recordedVideoUrl) {
            setTranscript({ text: '', error: 'No recorded video found.' });
            return;
        }
    
        setIsTranscribing(true);
        setTranscript({ text: '', error: null });
    
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const videoBlob = await fetch(recordedVideoUrl).then(res => res.blob());
    
            if (videoBlob.size > 250 * 1024 * 1024) { // 250MB limit
                 throw new Error("Video file is too large for transcription (max 250MB).");
            }
            
            const base64Data = await blobToBase64(videoBlob);
            
            const videoPart = {
                inlineData: {
                    mimeType: 'video/webm',
                    data: base64Data,
                },
            };
    
            const textPart = {
                text: 'Transcribe the audio from this video recording. The content is likely a technical tutorial or code explainer. Provide a clean, verbatim transcript without adding any extra commentary or formatting other than paragraphs for clarity.',
            };
    
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [videoPart, textPart] },
            });
    
            const transcription = response.text;
            if (transcription) {
                setTranscript({ text: transcription, error: null });
            } else {
                throw new Error('Transcription failed: The model returned an empty response.');
            }
    
        } catch (error: any) {
            console.error("Transcription error:", error);
            setTranscript({ text: '', error: `Transcription failed: ${error.message}` });
        } finally {
            setIsTranscribing(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey) {
                switch (e.key.toUpperCase()) {
                    case 'R': e.preventDefault(); if (recordingState === 'idle') startRecording(); break;
                    case 'P': e.preventDefault(); pauseResumeRecording(); break;
                    case 'S': e.preventDefault(); if (recordingState === 'recording' || recordingState === 'paused') stopRecording(); break;
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [recordingState, startRecording]);

    const isRecordingActive = recordingState === 'recording' || recordingState === 'paused';

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 flex flex-col p-4 md:p-6 lg:p-8 font-sans">
            {isCountingDown && <Countdown onFinish={handleCountdownFinish} />}
            {isPreparing && <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"><div className="text-xl font-bold text-white">Preparing streams...</div></div>}
            
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-3">
                         <div className={`flex items-center space-x-2 bg-slate-200 dark:bg-slate-800 p-2 rounded-lg transition-opacity duration-300 ${isRecordingActive ? 'opacity-100' : 'opacity-0'}`}>
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div><span className="text-sm font-semibold text-red-500 dark:text-red-400">REC</span>
                        </div>
                        <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white">LiveCap</h1>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Your professional screen recording studio.</p>
                </div>
                <button onClick={toggleTheme} className="p-2 rounded-full bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition">
                    {theme === 'dark' ? <Sun className="text-yellow-400" /> : <Moon className="text-slate-700" />}
                </button>
            </header>
            
            <main className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3 flex flex-col bg-slate-200 dark:bg-black rounded-lg shadow-2xl shadow-cyan-500/10 dark:shadow-cyan-900/20 overflow-hidden">
                    <VideoPreview
                        ref={canvasRef}
                        screenStream={screenStreamRef.current}
                        webcamStream={webcamStreamRef.current}
                        recordedVideoUrl={recordedVideoUrl}
                        isCountingDown={isCountingDown}
                        onRecordAgain={() => { setRecordedVideoUrl(null); setRecordingState('idle'); setTranscript({ text: '', error: null }); }}
                        onCanvasReady={handleCanvasReady}
                        isRecording={isRecordingActive}
                        webcamSettings={settings}
                        setWebcamPosition={(pos) => setSettings(p => ({...p, webcamPosition: pos}))}
                        isWebcamVisible={isWebcamVisible}
                        onGenerateTranscript={handleGenerateTranscript}
                        isTranscribing={isTranscribing}
                        transcript={transcript}
                        annotationPaths={annotationPaths}
                        setAnnotationPaths={setAnnotationPaths}
                        annotationConfig={{ tool: annotationTool, color: annotationColor, thickness: annotationThickness }}
                    />
                </div>
                <div className="lg:col-span-1 bg-slate-100 dark:bg-slate-800 p-6 rounded-lg shadow-lg">
                    <SettingsPanel settings={settings} setSettings={setSettings} audioSources={audioSources} isRecording={isRecordingActive} onApplyLowCpuPreset={applyLowCpuPreset} micStream={micStreamRef.current} />
                </div>
            </main>

            <footer className="mt-8">
                <Controls
                    recordingState={recordingState} onStart={startRecording} onStop={stopRecording} onPauseResume={pauseResumeRecording}
                    onToggleWebcam={toggleWebcamVisibility}
                    isWebcamEnabled={settings.webcamEnabled} isWebcamVisible={isWebcamVisible} isPreparing={isPreparing}
                    annotationTool={annotationTool} onAnnotationToolChange={setAnnotationTool}
                    annotationColor={annotationColor} onAnnotationColorChange={setAnnotationColor}
                    annotationThickness={annotationThickness} onAnnotationThicknessChange={setAnnotationThickness}
                    onUndo={handleUndoAnnotation} onClear={handleClearAnnotations}
                />
            </footer>
        </div>
    );
};
export default App;