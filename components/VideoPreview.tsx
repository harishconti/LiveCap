
import React, { useRef, useEffect, forwardRef, useState } from 'react';
import { Settings, WebcamPosition, AnnotationPath, AnnotationPoint, AnnotationTool } from '../types';
import { Camera, Download, FileText, Loader2, Play } from 'lucide-react';

type Transcript = { text: string; error: string | null };
interface VideoPreviewProps {
    screenStream: MediaStream | null; webcamStream: MediaStream | null; recordedVideoUrl: string | null;
    isCountingDown: boolean; isRecording: boolean; onRecordAgain: () => void; onCanvasReady: () => void;
    webcamSettings: Settings; setWebcamPosition: (pos: WebcamPosition) => void; isWebcamVisible: boolean;
    onGenerateTranscript: () => void; isTranscribing: boolean; transcript: Transcript;
    annotationPaths: AnnotationPath[]; setAnnotationPaths: (paths: AnnotationPath[]) => void;
    annotationConfig: { tool: AnnotationTool; color: string; thickness: number; };
}

const VideoPreview = forwardRef<HTMLCanvasElement, VideoPreviewProps>(({
    screenStream, webcamStream, recordedVideoUrl, isCountingDown, isRecording, onRecordAgain, onCanvasReady,
    webcamSettings, setWebcamPosition, isWebcamVisible, onGenerateTranscript, isTranscribing, transcript,
    annotationPaths, setAnnotationPaths, annotationConfig
}, ref) => {
    const screenVideoRef = useRef<HTMLVideoElement>(null);
    const webcamVideoRef = useRef<HTMLVideoElement>(null);
    const hasSignaledReadyRef = useRef(false);
    const showPreviewAndCanvas = isRecording || isCountingDown || (screenStream && screenStream.active);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const isDrawing = useRef(false);
    const previewVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const setupVideo = (videoEl: HTMLVideoElement | null, stream: MediaStream | null) => {
            if (!videoEl || !stream) return;
            // Only update srcObject if it's a new stream to prevent flickering
            if (videoEl.srcObject !== stream) {
                videoEl.srcObject = stream;
                // Wait for metadata to load to ensure dimensions are available and then play
                videoEl.onloadedmetadata = () => {
                    videoEl.play().catch(err => {
                        console.error(`Error playing video for stream ${stream.id}:`, err);
                    });
                };
            }
        };

        setupVideo(screenVideoRef.current, screenStream);
        setupVideo(webcamVideoRef.current, webcamStream);

        if (isCountingDown) {
            hasSignaledReadyRef.current = false;
        }
    }, [screenStream, webcamStream, isCountingDown]);

    useEffect(() => {
        const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
        const screenVideo = screenVideoRef.current;
        const webcamVideo = webcamVideoRef.current;
        if (!canvas || !screenVideo || !showPreviewAndCanvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        let animationFrameId: number;
        const render = () => {
            if (screenVideo.videoWidth === 0) { animationFrameId = requestAnimationFrame(render); return; }
            if (!hasSignaledReadyRef.current) { onCanvasReady(); hasSignaledReadyRef.current = true; }
            if (canvas.width !== screenVideo.videoWidth) { canvas.width = screenVideo.videoWidth; canvas.height = screenVideo.videoHeight; }
            ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

            annotationPaths.forEach(path => {
                ctx.beginPath();
                ctx.strokeStyle = path.color;
                ctx.lineWidth = path.thickness;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                path.points.forEach((point, index) => {
                    if (index === 0) ctx.moveTo(point.x * canvas.width, point.y * canvas.height);
                    else ctx.lineTo(point.x * canvas.width, point.y * canvas.height);
                });
                ctx.stroke();
            });

            if (webcamVideo && webcamVideo.videoWidth > 0 && webcamSettings.webcamEnabled && isWebcamVisible) {
                const webcamWidth = canvas.width * webcamSettings.webcamSize.scale;
                const webcamHeight = (webcamVideo.videoHeight / webcamVideo.videoWidth) * webcamWidth;
                const margin = canvas.width * 0.02;
                let x, y;

                if (typeof webcamSettings.webcamPosition === 'object') {
                    x = webcamSettings.webcamPosition.x;
                    y = webcamSettings.webcamPosition.y;
                } else {
                    switch(webcamSettings.webcamPosition) {
                        case 'top-left': x = margin; y = margin; break;
                        case 'top-right': x = canvas.width - webcamWidth - margin; y = margin; break;
                        case 'bottom-left': x = margin; y = canvas.height - webcamHeight - margin; break;
                        default: x = canvas.width - webcamWidth - margin; y = canvas.height - webcamHeight - margin; break;
                    }
                }
                
                ctx.save();
                if (webcamSettings.webcamShadow) { ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'; ctx.shadowBlur = 15; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 4; }
                ctx.beginPath();
                switch (webcamSettings.webcamShape) {
                    case 'circle':
                        ctx.arc(x + webcamWidth / 2, y + webcamHeight / 2, Math.min(webcamWidth, webcamHeight) / 2, 0, Math.PI * 2);
                        break;
                    case 'ellipse':
                        ctx.ellipse(x + webcamWidth / 2, y + webcamHeight / 2, webcamWidth / 2, webcamHeight / 2, 0, 0, Math.PI * 2);
                        break;
                    case 'rounded-square':
                        const r = Math.min(webcamWidth, webcamHeight) * 0.15;
                        ctx.moveTo(x + r, y);
                        ctx.arcTo(x + webcamWidth, y, x + webcamWidth, y + webcamHeight, r);
                        ctx.arcTo(x + webcamWidth, y + webcamHeight, x, y + webcamHeight, r);
                        ctx.arcTo(x, y + webcamHeight, x, y, r);
                        ctx.arcTo(x, y, x + webcamWidth, y, r);
                        break;
                    case 'rectangle':
                    default:
                        ctx.rect(x, y, webcamWidth, webcamHeight);
                        break;
                }
                ctx.closePath();
                if (webcamSettings.webcamBorder) { ctx.strokeStyle = 'white'; ctx.lineWidth = 4; ctx.stroke(); }
                ctx.clip();
                ctx.drawImage(webcamVideo, x, y, webcamWidth, webcamHeight);
                ctx.restore();
            }
            animationFrameId = requestAnimationFrame(render);
        };
        render(); return () => cancelAnimationFrame(animationFrameId);
    }, [isRecording, isCountingDown, screenStream, webcamStream, webcamSettings, isWebcamVisible, ref, showPreviewAndCanvas, onCanvasReady, annotationPaths]);

    const getPoint = (e: React.MouseEvent<HTMLCanvasElement>): AnnotationPoint => {
        const canvas = (ref as React.RefObject<HTMLCanvasElement>)?.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / canvas.width,
            y: (e.clientY - rect.top) / canvas.height,
        };
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isRecording || e.button !== 0) return;
        isDrawing.current = true;
        const point = getPoint(e);
        setAnnotationPaths([...annotationPaths, {
            points: [point],
            color: annotationConfig.color,
            thickness: annotationConfig.thickness,
        }]);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing.current || !isRecording) return;
        const point = getPoint(e);
        const newPaths = [...annotationPaths];
        const currentPath = newPaths[newPaths.length - 1];
        currentPath.points.push(point);
        setAnnotationPaths(newPaths);
    };

    const handleMouseUp = () => {
        isDrawing.current = false;
    };

    const downloadTranscript = (format: 'txt' | 'srt') => { /* ... (not implemented) ... */ };
    
    // The video elements are positioned off-screen to ensure they are rendered by the browser,
    // which is necessary for their content to be drawn onto the canvas. Using `display: 'none'`
    // can cause some browsers to stop rendering video frames, leading to a blank recording.
    const hiddenVideoStyle: React.CSSProperties = {
        position: 'absolute',
        top: '-9999px',
        left: '-9999px',
        width: '1px',
        height: '1px',
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-200 dark:bg-black relative">
            {showPreviewAndCanvas ? (
                <>
                    <canvas 
                        ref={ref} 
                        className="w-full h-full object-contain cursor-crosshair" 
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />
                    <video ref={screenVideoRef} autoPlay muted playsInline style={hiddenVideoStyle} />
                    {webcamSettings.webcamEnabled && <video ref={webcamVideoRef} autoPlay muted playsInline style={hiddenVideoStyle} />}
                </>
            ) : recordedVideoUrl ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 gap-4 overflow-y-auto">
                     <video ref={previewVideoRef} src={recordedVideoUrl} controls className="max-w-full max-h-[60%] rounded-lg shadow-lg" />
                     <div className="flex space-x-2">
                        <button onClick={onRecordAgain} className="flex items-center space-x-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded-md transition"><Play size={16}/><span>Record Again</span></button>
                        <a href={recordedVideoUrl} download="recording.webm" className="flex items-center space-x-2 bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-4 rounded-md transition"><Download size={16}/><span>Download</span></a>
                     </div>
                     <div className="w-full max-w-2xl p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                         <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><FileText size={20}/>Transcript</h3>
                         <button onClick={onGenerateTranscript} disabled={isTranscribing || !!transcript.text} className="w-full mb-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                             {isTranscribing ? <><Loader2 className="animate-spin" size={18}/><span>Generating...</span></> : 'Generate Transcript'}
                         </button>
                         {transcript.error && <p className="text-red-500 bg-red-100 dark:bg-red-900/50 p-2 rounded-md">{transcript.error}</p>}
                         {transcript.text && (
                             <div className="prose prose-sm dark:prose-invert max-h-40 overflow-y-auto p-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900">
                                 <p>{transcript.text}</p>
                             </div>
                         )}
                     </div>
                </div>
            ) : (
                <div className="text-center text-slate-500 dark:text-slate-400 p-8 flex flex-col justify-center items-center h-full">
                    <Camera size={64} className="mx-auto mb-4 opacity-50" />
                    <h2 className="text-2xl font-semibold">Ready to Record</h2>
                    <p className="mt-2">Adjust your settings and press "Start Recording" to begin.</p>
                    <div className="mt-6 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg max-w-md text-sm">
                        <p><span className="font-bold text-cyan-600 dark:text-cyan-400">Pro Tip:</span> To record applications outside of this browser, be sure to select <strong className="text-slate-700 dark:text-slate-200">'Entire Screen'</strong> when the permission prompt appears.</p>
                    </div>
                </div>
            )}
        </div>
    );
});

export default VideoPreview;
