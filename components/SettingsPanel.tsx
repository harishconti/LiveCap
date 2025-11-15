import React, { useEffect, useRef } from 'react';
import { Settings, AudioSource, WebcamShape } from '../types';
import { RESOLUTIONS, FRAME_RATES, BITRATES, WEBCAM_SIZES, WEBCAM_SHAPES } from '../constants';
import { Cpu } from 'lucide-react';

interface AudioLevelMeterProps {
    micStream: MediaStream | null;
}
const AudioLevelMeter: React.FC<AudioLevelMeterProps> = ({ micStream }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!micStream || !canvasRef.current) return;
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(micStream);
        source.connect(analyser);

        analyser.fftSize = 512;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        let animationFrameId: number;
        const draw = () => {
            animationFrameId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#475569'; // dark:bg-slate-600
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (average / 128) * canvas.width;
            ctx.fillStyle = '#06b6d4'; // cyan-500
            ctx.fillRect(0, 0, barWidth, canvas.height);
        };
        draw();
        return () => {
            cancelAnimationFrame(animationFrameId);
            audioContext.close();
        };
    }, [micStream]);

    return <canvas ref={canvasRef} height="10" className="w-full rounded-full bg-slate-200 dark:bg-slate-600 h-2.5"></canvas>;
};

interface SettingsPanelProps {
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    audioSources: AudioSource[];
    isRecording: boolean;
    onApplyLowCpuPreset: () => void;
    micStream: MediaStream | null;
}

const SettingGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    return (
        <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">{title}</h3>
            <div className="space-y-3">{children}</div>
        </div>
    );
};

const SelectControl: React.FC<any> = ({ label, value, onChange, options, disabled, optionValueKey = 'value', optionLabelKey = 'label' }) => {
    return (
        <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</label>
            <select
                value={value}
                onChange={onChange}
                disabled={disabled}
                className="w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
                {options.map((opt: any, index: number) => (
                    <option key={index} value={typeof opt === 'object' ? opt[optionValueKey] : opt}>
                        {typeof opt === 'object' ? opt[optionLabelKey] : opt}
                    </option>
                ))}
            </select>
        </div>
    );
};

const CheckboxControl: React.FC<any> = ({ label, checked, onChange, disabled }) => {
    return (
        <label className="flex items-center space-x-3 cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                className="h-5 w-5 rounded bg-slate-200 dark:bg-slate-600 border-slate-400 dark:border-slate-500 text-cyan-500 dark:text-cyan-400 focus:ring-cyan-500 dark:focus:ring-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        </label>
    );
};


const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, setSettings, audioSources, isRecording, onApplyLowCpuPreset, micStream }) => {
    const handleSettingChange = <K extends keyof Settings,>(key: K, value: Settings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white pb-2">Settings</h2>
            <div className="space-y-6 flex-grow overflow-y-auto pr-2">
                <SettingGroup title="Presets">
                     <button onClick={onApplyLowCpuPreset} className="w-full flex items-center justify-center space-x-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded-md transition disabled:opacity-50" disabled={isRecording}>
                        <Cpu size={18} />
                        <span>Apply Low CPU Preset</span>
                    </button>
                </SettingGroup>
                <SettingGroup title="Video Quality">
                    <SelectControl label="Resolution" value={settings.resolution.label} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSettingChange('resolution', RESOLUTIONS.find(r => r.label === e.target.value)!)} options={RESOLUTIONS.map(r => r.label)} disabled={isRecording}/>
                    <SelectControl label="Frame Rate" value={settings.frameRate.value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSettingChange('frameRate', FRAME_RATES.find(r => r.value === parseInt(e.target.value))!)} options={FRAME_RATES} optionValueKey="value" optionLabelKey="label" disabled={isRecording}/>
                    <SelectControl label="Bitrate" value={settings.bitrate.label} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleSettingChange('bitrate', BITRATES.find(b => b.label === e.target.value)!)} options={BITRATES.map(b => b.label)} disabled={isRecording}/>
                </SettingGroup>
                <SettingGroup title="Audio">
                    <SelectControl label="Microphone" value={settings.audioSource} onChange={e => handleSettingChange('audioSource', e.target.value)} options={[{ id: 'default', label: 'Default Microphone' }, ...audioSources]} optionValueKey="id" optionLabelKey="label" disabled={isRecording}/>
                    <AudioLevelMeter micStream={micStream} />
                    <CheckboxControl label="Include System Audio" checked={settings.includeSystemAudio} onChange={e => handleSettingChange('includeSystemAudio', e.target.checked)} disabled={isRecording}/>
                </SettingGroup>
                <SettingGroup title="Webcam">
                    <CheckboxControl label="Enable Webcam" checked={settings.webcamEnabled} onChange={e => handleSettingChange('webcamEnabled', e.target.checked)} disabled={isRecording}/>
                     {settings.webcamEnabled && (
                         <>
                            <SelectControl label="Webcam Size" value={settings.webcamSize.label} onChange={e => handleSettingChange('webcamSize', WEBCAM_SIZES.find(s => s.label === e.target.value)!)} options={WEBCAM_SIZES.map(s => s.label)} disabled={isRecording}/>
                            <SelectControl label="Webcam Shape" value={settings.webcamShape} onChange={e => handleSettingChange('webcamShape', e.target.value as WebcamShape)} options={WEBCAM_SHAPES} optionValueKey="value" optionLabelKey="label" disabled={isRecording}/>
                            <CheckboxControl label="Show Border" checked={settings.webcamBorder} onChange={e => handleSettingChange('webcamBorder', e.target.checked)} disabled={isRecording}/>
                            <CheckboxControl label="Show Shadow" checked={settings.webcamShadow} onChange={e => handleSettingChange('webcamShadow', e.target.checked)} disabled={isRecording}/>
                         </>
                     )}
                </SettingGroup>
                 <SettingGroup title="Webcam Background">
                    <div className="text-sm text-center p-2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                        Background effects (blur, image) are coming soon!
                    </div>
                 </SettingGroup>
            </div>
        </div>
    );
};

export default SettingsPanel;